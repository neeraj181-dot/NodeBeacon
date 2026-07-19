from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from users.serializers import UserRegisterSerializer, UserSerializer

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                UserSerializer(user).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework_simplejwt.views import TokenObtainPairView as SimpleJWTTokenObtainPairView
import logging
logger = logging.getLogger(__name__)

class TokenObtainPairView(SimpleJWTTokenObtainPairView):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        logger.info(f"Incoming login attempt: email={username}")

        from django.contrib.auth import get_user_model
        UserClass = get_user_model()
        try:
            user = UserClass.objects.get(username__iexact=username)
            logger.info("User found matching incoming username.")
            if not user.is_active:
                return Response({"detail": "Account disabled."}, status=status.HTTP_400_BAD_REQUEST)
            if not user.check_password(password):
                logger.warning("Password validation failed.")
                return Response({"detail": "Password incorrect."}, status=status.HTTP_400_BAD_REQUEST)
            logger.info("Password validation succeeded.")
        except UserClass.DoesNotExist:
            logger.warning("No user found matching incoming email.")
            return Response({"detail": "User not found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            response = super().post(request, *args, **kwargs)
            logger.info("Authentication response succeeded, JWT tokens dispatched.")
            return response
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return Response(
                {"detail": "Authentication failed. Invalid email address or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )


from rest_framework.generics import RetrieveUpdateAPIView

class ProfileView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class TestEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from alerts.services import send_alert_email
        from servers.models import Server
        from collections import namedtuple
        
        user = request.user
        # Resolve any existing server or fake one
        server = Server.objects.filter(owner=user).first()
        if not server:
            # Create a mock server instance for demonstration (not saved to database)
            server = Server(
                name="TUFF (Test)",
                hostname="tuff-laptop",
                operating_system="Windows 11 Pro",
                ip_address="192.168.1.100"
            )
            
        MockMetric = namedtuple('Metric', ['cpu_usage', 'memory_usage', 'disk_usage'])
        metric = MockMetric(cpu_usage=92.5, memory_usage=88.1, disk_usage=45.2)

        try:
            send_alert_email(
                user=user,
                server=server,
                title="High CPU Usage (Test Alert)",
                description="This is a test notification confirming your NodeBeacon SMTP settings are correctly integrated.",
                metric=metric
            )
            return Response(
                {"success": True, "message": "Test email sent successfully."},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"success": False, "message": f"SMTP Dispatch Error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {"error": "Both current_password and new_password fields are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user.set_password(new_password)
            user.save()
            return Response(
                {"success": True, "message": "Password updated successfully."},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to set password: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RecoverPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        if not email:
            return Response({"error": "email field is required."}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        UserClass = get_user_model()
        try:
            user = UserClass.objects.get(email__iexact=email)
        except UserClass.DoesNotExist:
            return Response({"error": "No account associated with this email address."}, status=status.HTTP_404_NOT_FOUND)

        # Generate a secure reset link (using a dummy recovery code or token flow)
        import uuid
        reset_token = str(uuid.uuid4())
        reset_link = f"http://localhost:5173/reset-password?token={reset_token}"

        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags

        subject = "🔐 NodeBeacon Password Recovery"
        html_message = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #0c0c0c; color: #ffffff; padding: 20px; text-align: center;">
                <div style="max-width: 600px; margin: auto; background-color: #111111; border: 1px solid #57E389; border-radius: 12px; padding: 30px;">
                    <h2 style="color: #57E389;">NodeBeacon Password Recovery</h2>
                    <p style="color: #cccccc; font-size: 14px;">We received a request to reset your password. Click the link below to verify your account and set a new password:</p>
                    <a href="{reset_link}" style="display: inline-block; background-color: #57E389; color: #000000; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
                    <p style="color: #888888; font-size: 11px;">If you did not request this email, you can safely ignore it.</p>
                </div>
            </body>
        </html>
        """
        plain_message = strip_tags(html_message)

        try:
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=None,  # Defaults to DEFAULT_FROM_EMAIL
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            return Response({"success": True, "message": "Recovery link dispatched successfully."})
        except Exception as e:
            return Response(
                {"error": f"SMTP Dispatch failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrganizationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        if not user.organization:
            return Response({"error": "You do not belong to any organization."}, status=status.HTTP_404_NOT_FOUND)
        org = user.organization
        return Response({
            "organization_name": org.organization_name,
            "alert_email": org.alert_email,
            "alert_recipients": org.alert_recipients,
            "owner": org.owner.email,
        })

    def patch(self, request, *args, **kwargs):
        user = request.user
        if not user.organization:
            return Response({"error": "You do not belong to any organization."}, status=status.HTTP_404_NOT_FOUND)
        if user.role != 'ORGANIZATION_ADMIN':
            return Response({"error": "Only administrators can configure organization preferences."}, status=status.HTTP_403_FORBIDDEN)
        
        org = user.organization
        org_name = request.data.get("organization_name")
        alert_email = request.data.get("alert_email")
        alert_recipients = request.data.get("alert_recipients")

        if org_name:
            org.organization_name = org_name
        if alert_email:
            org.alert_email = alert_email
        if alert_recipients is not None:
            org.alert_recipients = alert_recipients
        org.save()

        return Response({
            "organization_name": org.organization_name,
            "alert_email": org.alert_email,
            "alert_recipients": org.alert_recipients,
            "owner": org.owner.email,
        })


class MemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        if not user.organization:
            return Response({"error": "You do not belong to any organization."}, status=status.HTTP_404_NOT_FOUND)
        members = user.organization.members.all()
        serializer = UserSerializer(members, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        user = request.user
        if not user.organization:
            return Response({"error": "You do not belong to any organization."}, status=status.HTTP_404_NOT_FOUND)
        if user.role != 'ORGANIZATION_ADMIN':
            return Response({"error": "Only administrators can invite members."}, status=status.HTTP_403_FORBIDDEN)

        username = request.data.get("username")
        email = request.data.get("email")
        member_role = request.data.get("member_role", "VIEWER")
        password = request.data.get("password", "NodeBeaconInvitedTemp123!")

        if not username or not email:
            return Response({"error": "username and email fields are required."}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        UserClass = get_user_model()

        if UserClass.objects.filter(username__iexact=username).exists():
            return Response({"error": "A user with this username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if UserClass.objects.filter(email__iexact=email).exists():
            return Response({"error": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_user = UserClass.objects.create_user(
                username=username,
                email=email,
                password=password,
                role='MEMBER',
                member_role=member_role,
                organization=user.organization
            )
            return Response(UserSerializer(new_user).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, *args, **kwargs):
        user = request.user
        if not user.organization:
            return Response({"error": "You do not belong to any organization."}, status=status.HTTP_404_NOT_FOUND)
        if user.role != 'ORGANIZATION_ADMIN':
            return Response({"error": "Only administrators can assign member roles."}, status=status.HTTP_403_FORBIDDEN)

        try:
            member = user.organization.members.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        member_role = request.data.get("member_role")
        if member_role in ['ADMINISTRATOR', 'OPERATOR', 'VIEWER']:
            member.member_role = member_role
            if member_role == 'ADMINISTRATOR':
                member.role = 'ORGANIZATION_ADMIN'
            else:
                member.role = 'MEMBER'
            member.save()
            return Response(UserSerializer(member).data)
        return Response({"error": "Invalid member role choices."}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, *args, **kwargs):
        user = request.user
        if not user.organization:
            return Response({"error": "You do not belong to any organization."}, status=status.HTTP_404_NOT_FOUND)
        if user.role != 'ORGANIZATION_ADMIN':
            return Response({"error": "Only administrators can remove members."}, status=status.HTTP_403_FORBIDDEN)

        try:
            member = user.organization.members.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        if member == user:
            return Response({"error": "You cannot remove yourself from the organization."}, status=status.HTTP_400_BAD_REQUEST)

        # Dissociate or delete member (here we dissociate them so they default back to individual)
        member.organization = None
        member.role = 'INDIVIDUAL'
        member.member_role = 'VIEWER'
        member.save()
        return Response({"success": True, "message": "Member removed successfully."})


