from rest_framework import serializers
from servers.models import Server

class ServerSerializer(serializers.ModelSerializer):
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
        )
        read_only_fields = (
            'id',
            'status', # The user shouldn't change this directly; status will update when agents contact
            'api_key',
            'last_seen',
            'created_at',
            'updated_at',
        )

    def validate_name(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_hostname(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Hostname cannot be empty.")
        return value
