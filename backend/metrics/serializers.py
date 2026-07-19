from rest_framework import serializers
from metrics.models import Metric

class MetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = Metric
        fields = (
            'id',
            'server',
            'cpu_usage',
            'memory_usage',
            'disk_usage',
            'network_in',
            'network_out',
            'uptime',
            'timestamp',
        )
        read_only_fields = ('id', 'server', 'timestamp')

    def validate_cpu_usage(self, value):
        if not (0.0 <= value <= 100.0):
            raise serializers.ValidationError("CPU usage must be between 0.0 and 100.0 percent.")
        return value

    def validate_memory_usage(self, value):
        if not (0.0 <= value <= 100.0):
            raise serializers.ValidationError("Memory usage must be between 0.0 and 100.0 percent.")
        return value

    def validate_disk_usage(self, value):
        if not (0.0 <= value <= 100.0):
            raise serializers.ValidationError("Disk usage must be between 0.0 and 100.0 percent.")
        return value

    def validate_network_in(self, value):
        if value < 0:
            raise serializers.ValidationError("Network traffic (in) cannot be negative.")
        return value

    def validate_network_out(self, value):
        if value < 0:
            raise serializers.ValidationError("Network traffic (out) cannot be negative.")
        return value

    def validate_uptime(self, value):
        if value < 0:
            raise serializers.ValidationError("Uptime cannot be negative.")
        return value
