from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import RegisterView, ProfileView, TestEmailView, ChangePasswordView, OrganizationSettingsView, MemberListView, MemberDetailView, TokenObtainPairView, RecoverPasswordView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/profile/', ProfileView.as_view(), name='auth_profile'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('auth/recover-password/', RecoverPasswordView.as_view(), name='recover_password'),
    path('organization/settings/', OrganizationSettingsView.as_view(), name='org_settings'),
    path('organization/members/', MemberListView.as_view(), name='org_members'),
    path('organization/members/<int:pk>/', MemberDetailView.as_view(), name='org_member_detail'),
    path('test-email/', TestEmailView.as_view(), name='test_email'),
]
