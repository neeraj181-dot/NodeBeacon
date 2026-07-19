from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from servers.models import Server
from metrics.models import Metric
from metrics.serializers import MetricSerializer
from metrics.authentication import AgentAPIKeyAuthentication
from metrics.permissions import IsAgent

class MetricsListCreateView(generics.ListCreateAPIView):
    """
    POST /api/metrics/ - Agent submits server metrics (API Key auth)
    GET /api/metrics/ - User lists all server metrics (JWT auth)
    """
    serializer_class = MetricSerializer

    def get_authenticators(self):
        if self.request and self.request.method == 'POST':
            return [AgentAPIKeyAuthentication()]
        return super().get_authenticators()

    def get_permissions(self):
        if self.request and self.request.method == 'POST':
            return [IsAgent()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # GET returns metrics for all servers belonging to the user
        return Metric.objects.filter(server__owner=self.request.user)

    def perform_create(self, serializer):
        server = self.request.auth  # Server instance resolved by API Key auth
        metric = serializer.save(server=server)
        
        # Update server status and timestamp
        server.status = 'Online'
        server.last_seen = timezone.now()
        
        # Update server metadata if provided in request payload (auto-detected from agent)
        agent_os = self.request.data.get('operating_system')
        agent_hostname = self.request.data.get('hostname')
        
        # Resolve client IP
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else self.request.META.get('REMOTE_ADDR')
        
        update_fields = ['status', 'last_seen', 'updated_at']
        
        if agent_os and server.operating_system != agent_os:
            server.operating_system = agent_os
            update_fields.append('operating_system')
            
        if agent_hostname and server.hostname != agent_hostname:
            server.hostname = agent_hostname
            update_fields.append('hostname')
            
        if ip and ip != '127.0.0.1' and server.ip_address != ip:
            server.ip_address = ip
            update_fields.append('ip_address')
            
        server.save(update_fields=update_fields)

        # Evaluate alert rules for the newly stored metric
        from alerts.services import evaluate_metrics_alerts
        evaluate_metrics_alerts(metric)



    def create(self, request, *args, **kwargs):
        super().create(request, *args, **kwargs)
        return Response(
            {"message": "Metric stored successfully."},
            status=status.HTTP_201_CREATED
        )


class ServerMetricsListView(generics.ListAPIView):
    """
    GET /api/servers/{server_id}/metrics/
    Endpoint to retrieve historical metrics for a specific server.
    Requires JWT authentication.
    """
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        server_id = self.kwargs.get('server_id')
        # Validate that the server exists and belongs to the request user
        server = get_object_or_404(Server, id=server_id, owner=self.request.user)
        
        queryset = Metric.objects.filter(server=server)
        
        # Support limit parameter
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                limit = int(limit)
                if limit > 0:
                    queryset = queryset[:limit]
            except ValueError:
                pass  # Ignore invalid limit parameters
                
        return queryset
