from django.contrib.auth.models import AbstractUser
from django.db import models

class Organization(models.Model):
    organization_name = models.CharField(max_length=255)
    alert_email = models.EmailField()
    alert_recipients = models.TextField(default='', blank=True)  # Comma separated list of emails
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey('User', on_delete=models.CASCADE, related_name='owned_organizations')

    def __str__(self):
        return self.organization_name


class User(AbstractUser):
    ROLE_CHOICES = (
        ('INDIVIDUAL', 'Individual'),
        ('ORGANIZATION_ADMIN', 'Organization Admin'),
        ('MEMBER', 'Member'),
    )

    MEMBER_ROLE_CHOICES = (
        ('ADMINISTRATOR', 'Administrator'),
        ('OPERATOR', 'Operator'),
        ('VIEWER', 'Viewer'),
    )

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='INDIVIDUAL')
    member_role = models.CharField(max_length=30, choices=MEMBER_ROLE_CHOICES, default='VIEWER')
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')

    # Notification & Alert Settings
    enable_email_notifications = models.BooleanField(default=True)
    enable_desktop_notifications = models.BooleanField(default=True)
    notify_on_laptop_unlock = models.BooleanField(default=False)
    notify_on_laptop_unlock_telegram = models.BooleanField(default=False)
    recipient_email = models.EmailField(blank=True, null=True)
    email_verified = models.BooleanField(default=False)
    email_unverified_recipient = models.EmailField(blank=True, null=True)
    email_verification_token_hash = models.CharField(max_length=64, blank=True, null=True)
    email_verification_link_hash = models.CharField(max_length=64, blank=True, null=True)
    email_verification_sent_at = models.DateTimeField(blank=True, null=True)
    email_verification_expires_at = models.DateTimeField(blank=True, null=True)

    # Email notification category preferences
    notify_offline_email = models.BooleanField(default=True)
    notify_critical_email = models.BooleanField(default=True)

    telegram_chat_id = models.CharField(max_length=64, blank=True, null=True, unique=True)
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)

    cpu_threshold = models.FloatField(default=90.0)
    memory_threshold = models.FloatField(default=90.0)
    disk_threshold = models.FloatField(default=95.0)
    heartbeat_timeout = models.IntegerField(default=60) # in seconds

    def __str__(self):
        return self.email


class TelegramPairing(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='telegram_pairings')
    code_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)


class TelegramBotCursor(models.Model):
    """Tracks consumed Telegram updates so pairing requests aren't replayed."""
    update_offset = models.BigIntegerField(default=0)
