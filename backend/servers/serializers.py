from rest_framework import serializers
from servers.models import Server

class ServerSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source='owner.email')
    agent_connection_status = serializers.SerializerMethodField()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and instance.owner_id != request.user.pk:
            for field in ('api_key', 'device_id', 'agent_server_url', 'agent_server_port',
                          'config_version', 'agent_connection_status', 'agent_last_seen', 'agent_version'):
                data.pop(field, None)
        return data

    def get_agent_connection_status(self, obj):
        from django.utils import timezone
        if not obj.device_token_hash:
            return 'Not installed'
        if obj.agent_status == 'Stopped':
            return 'Stopped'
        if not obj.agent_last_seen or (timezone.now() - obj.agent_last_seen).total_seconds() > 90:
            return 'Offline'
        return obj.agent_status

    class Meta:
        model = Server
        fields = (
            'id',
            'name',
            'hostname',
            'operating_system',
            'ip_address',
            'status',
            'api_key',
            'last_seen',
            'created_at',
            'updated_at',
            'owner_email',
            'department',
            'location',
            'organization',
            'device_id', 'agent_server_url', 'agent_server_port', 'config_version',
            'agent_connection_status', 'agent_last_seen', 'agent_version',
        )
        read_only_fields = (
            'id',
            'status',
            'api_key',
            'last_seen',
            'created_at',
            'updated_at',
            'owner_email',
            'device_id', 'agent_server_url', 'agent_server_port', 'config_version',
            'agent_connection_status', 'agent_last_seen', 'agent_version', 'organization',
        )

    def validate_name(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_hostname(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Hostname cannot be empty.")
        return value
