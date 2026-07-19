from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from servers.models import Server

class Metric(models.Model):
    server = models.ForeignKey(
        Server,
        on_delete=models.CASCADE,
        related_name='metrics',
        db_index=True
    )
    
    cpu_usage = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    memory_usage = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    disk_usage = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    
    network_in = models.BigIntegerField(
        validators=[MinValueValidator(0)]
    )
    network_out = models.BigIntegerField(
        validators=[MinValueValidator(0)]
    )
    
    uptime = models.BigIntegerField(
        validators=[MinValueValidator(0)]
    )
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.server.name} - CPU: {self.cpu_usage}% - {self.timestamp}"
