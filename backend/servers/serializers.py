from rest_framework import serializers
from servers.models import Server

class ServerSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source='owner.email')

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
        )
        read_only_fields = (
            'id',
            'status',
            'api_key',
            'last_seen',
            'created_at',
            'updated_at',
            'owner_email',
        )

    def validate_name(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_hostname(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Hostname cannot be empty.")
        return value
