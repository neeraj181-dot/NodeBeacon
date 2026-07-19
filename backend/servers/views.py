from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from servers.models import Server
from servers.serializers import ServerSerializer
from servers.permissions import IsOwner

class ServerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ServerSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
            return Server.objects.filter(organization=user.organization).order_by('-created_at')
        return Server.objects.filter(owner=user).order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
            serializer.save(owner=user, organization=user.organization)
        else:
            serializer.save(owner=user)
