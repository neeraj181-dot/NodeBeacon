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

    def save(self, *args, **kwargs):
        # Automatically generate a cryptographically secure, unique API key on create.
        if not self.api_key:
            # secrets.token_hex(24) returns a 48-character hex string which fits easily in max_length=64
            self.api_key = secrets.token_hex(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.hostname})"
