from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

from users.models import Organization

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ('id', 'organization_name', 'alert_email', 'alert_recipients', 'created_at', 'owner')


class UserSerializer(serializers.ModelSerializer):
    organization_details = OrganizationSerializer(source='organization', read_only=True)

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 'date_joined',
            'enable_email_notifications', 'enable_desktop_notifications', 'recipient_email',
            'cpu_threshold', 'memory_threshold', 'disk_threshold', 'heartbeat_timeout',
            'role', 'member_role', 'organization', 'organization_details'
        )
        read_only_fields = ('id', 'date_joined')


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    organization_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    alert_email = serializers.EmailField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'organization_name', 'alert_email')
        extra_kwargs = {
            'username': {'required': True},
            'email': {'required': True},
        }

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate(self, attrs):
        role = attrs.get('role', 'INDIVIDUAL')
        if role == 'ORGANIZATION_ADMIN':
            if not attrs.get('organization_name'):
                raise serializers.ValidationError({"organization_name": "This field is required for Organization accounts."})
            if not attrs.get('alert_email'):
                raise serializers.ValidationError({"alert_email": "This field is required for Organization accounts."})
        return attrs

    def create(self, validated_data):
        role = validated_data.get('role', 'INDIVIDUAL')
        org_name = validated_data.pop('organization_name', None)
        org_alert = validated_data.pop('alert_email', None)

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=role,
            member_role='ADMINISTRATOR' if role == 'ORGANIZATION_ADMIN' else 'VIEWER'
        )

        if role == 'ORGANIZATION_ADMIN' and org_name:
            org = Organization.objects.create(
                organization_name=org_name,
                alert_email=org_alert or user.email,
                owner=user
            )
            user.organization = org
            user.save(update_fields=['organization'])

        return user
