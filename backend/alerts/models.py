from django.db import models
from servers.models import Server
from metrics.models import Metric

class Alert(models.Model):
    SEVERITY_CHOICES = (
        ('Info', 'Info'),
        ('Warning', 'Warning'),
        ('Critical', 'Critical'),
    )

    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Resolved', 'Resolved'),
    )

    server = models.ForeignKey(
        Server,
        on_delete=models.CASCADE,
        related_name='alerts',
        db_index=True
    )
    metric = models.ForeignKey(
        Metric,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alerts'
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    severity = models.CharField(max_length=15, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='Active', db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.server.name} - {self.title} ({self.status})"
