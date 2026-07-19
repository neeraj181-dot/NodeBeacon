from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from servers.models import Server
from servers.serializers import ServerSerializer
from servers.permissions import IsOwner

class ServerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwner]
    serializer_class = ServerSerializer

    def get_queryset(self):
        # Enforce that users can only view their own servers
        return Server.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # Automatically assign the request user as owner when registering a new server node
        serializer.save(owner=self.request.user)
