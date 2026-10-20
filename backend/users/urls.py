from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import RegisterView, ProfileView, TestEmailView, ChangePasswordView, OrganizationSettingsView, MemberListView, MemberDetailView, TokenObtainPairView, RecoverPasswordView, TelegramSettingsView, TelegramConnectStartView, TelegramConnectVerifyView, TelegramTestView
from users.unlock_views import LaptopUnlockNotificationView
from users.google_views import GoogleAuthUrlView, GoogleAuthExchangeView, GoogleAuthCallbackView

from users.email_views import (
    EmailSettingsView, EmailConnectView, EmailVerifyView,
    EmailResendView, EmailVerifyLinkView, EmailTestView,
)

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='auth_login'),
    path('auth/google/url/', GoogleAuthUrlView.as_view(), name='google_auth_url'),
    path('auth/google/', GoogleAuthExchangeView.as_view(), name='google_auth_exchange'),
    path('auth/google/callback/', GoogleAuthCallbackView.as_view(), name='google_auth_callback'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/profile/', ProfileView.as_view(), name='auth_profile'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('auth/recover-password/', RecoverPasswordView.as_view(), name='recover_password'),
    path('organization/settings/', OrganizationSettingsView.as_view(), name='org_settings'),
    path('organization/members/', MemberListView.as_view(), name='org_members'),
    path('organization/members/<int:pk>/', MemberDetailView.as_view(), name='org_member_detail'),
    path('test-email/', TestEmailView.as_view(), name='test_email'),
    path('email/settings/', EmailSettingsView.as_view(), name='email_settings'),
    path('email/connect/', EmailConnectView.as_view(), name='email_connect'),
    path('email/verify/', EmailVerifyView.as_view(), name='email_verify'),
    path('email/resend/', EmailResendView.as_view(), name='email_resend'),
    path('email/verify-link/', EmailVerifyLinkView.as_view(), name='email_verify_link'),
    path('email/test/', EmailTestView.as_view(), name='email_test'),
    path('telegram/settings/', TelegramSettingsView.as_view(), name='telegram_settings'),
    path('telegram/connect/start/', TelegramConnectStartView.as_view(), name='telegram_connect_start'),
    path('telegram/connect/verify/', TelegramConnectVerifyView.as_view(), name='telegram_connect_verify'),
    path('telegram/test/', TelegramTestView.as_view(), name='telegram_test'),
    path('servers/agents/unlocked/', LaptopUnlockNotificationView.as_view(), name='agent-laptop-unlocked'),
]
