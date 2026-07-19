from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from alerts.models import Alert
from alerts.serializers import AlertSerializer
from alerts.services import check_and_trigger_offline_servers

class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing and resolving NodeBeacon alerts.
    Provides List, Retrieve, and manual Resolve triggers.
    """
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 1. Dynamically scan and mark servers that went offline since last poll
        check_and_trigger_offline_servers()

        # 2. Return alerts belonging only to the user's servers
        queryset = Alert.objects.filter(server__owner=self.request.user).order_by('-created_at')

        # 3. Dynamic Query Parameter Filtering
        status_param = self.request.query_params.get('status')
        severity_param = self.request.query_params.get('severity')
        server_param = self.request.query_params.get('server')

        if status_param:
            queryset = queryset.filter(status=status_param)
        if severity_param:
            queryset = queryset.filter(severity=severity_param)
        if server_param:
            queryset = queryset.filter(server_id=server_param)

        return queryset

    @action(detail=True, methods=['patch'], url_path='resolve')
    def resolve(self, request, pk=None):
        """
        PATCH /api/alerts/{id}/resolve/
        Allows users to manually mark an alert as resolved.
        """
        alert = self.get_object()
        
        if alert.status == 'Resolved':
            return Response(
                {"message": "This alert is already resolved."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        alert.status = 'Resolved'
        alert.resolved_at = timezone.now()
        alert.save(update_fields=['status', 'resolved_at'])
        
        return Response(
            {"message": "Alert marked as resolved successfully.", "status": "Resolved"}
        )
