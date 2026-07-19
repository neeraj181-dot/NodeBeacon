from rest_framework import serializers
from alerts.models import Alert
from servers.serializers import ServerSerializer

class AlertSerializer(serializers.ModelSerializer):
    server_details = ServerSerializer(source='server', read_only=True)

    class Meta:
        model = Alert
        fields = (
            'id',
            'server',
            'server_details',
            'metric',
            'title',
            'description',
            'severity',
            'status',
            'created_at',
            'resolved_at',
        )
        read_only_fields = (
            'id',
            'server',
            'metric',
            'created_at',
            'resolved_at',
        )
