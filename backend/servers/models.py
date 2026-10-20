import hashlib
import secrets
from django.db import models
from django.conf import settings

class Server(models.Model):
    STATUS_CHOICES = (
        ('Online', 'Online'),
        ('Offline', 'Offline'),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='servers',
        db_index=True
    )
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='servers'
    )
    department = models.CharField(max_length=255, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    name = models.CharField(max_length=255)
    hostname = models.CharField(max_length=255)
    operating_system = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField()
    api_key = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Offline')
    
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    device_id = models.UUIDField(null=True, blank=True, unique=True)
    device_token_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    agent_server_url = models.CharField(max_length=255, blank=True, default='')
    agent_server_port = models.PositiveIntegerField(null=True, blank=True)
    config_version = models.PositiveIntegerField(default=1)
    agent_status = models.CharField(max_length=20, default='Not installed')
    agent_last_seen = models.DateTimeField(null=True, blank=True)
    agent_version = models.CharField(max_length=30, blank=True, default='')

    class Meta:
        indexes = [
            models.Index(fields=['owner', '-created_at'], name='server_owner_created_idx'),
            models.Index(fields=['organization', '-created_at'], name='server_org_created_idx'),
        ]

    def save(self, *args, **kwargs):
        # Automatically generate a cryptographically secure, unique API key on create.
        if not self.api_key:
            # secrets.token_hex(24) returns a 48-character hex string which fits easily in max_length=64
            self.api_key = secrets.token_hex(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.hostname})"


class AgentEnrollment(models.Model):
    server = models.ForeignKey(Server, on_delete=models.CASCADE, related_name='agent_enrollments')
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def set_token(self, token):
        self.token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

    class Meta:
        indexes = [
            models.Index(fields=['server', 'expires_at'], name='enroll_server_exp_idx'),
        ]


class UnlockNotification(models.Model):
    DELIVERY_CHOICES = (('Pending', 'Pending'), ('Sent', 'Sent'), ('Failed', 'Failed'), ('Disabled', 'Disabled'))
    server = models.ForeignKey(Server, on_delete=models.CASCADE, related_name='unlock_notifications')
    event_id = models.UUIDField(unique=True)
    delivery_status = models.CharField(max_length=12, choices=DELIVERY_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)
    attempted_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['server', '-created_at'], name='unlock_server_created_idx')]
