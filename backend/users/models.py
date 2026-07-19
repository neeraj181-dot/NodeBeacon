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
    recipient_email = models.EmailField(blank=True, null=True)

    cpu_threshold = models.FloatField(default=90.0)
    memory_threshold = models.FloatField(default=90.0)
    disk_threshold = models.FloatField(default=95.0)
    heartbeat_timeout = models.IntegerField(default=60) # in seconds

    def __str__(self):
        return self.email
