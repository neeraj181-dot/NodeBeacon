from rest_framework import permissions
from servers.models import Server

class IsAgent(permissions.BasePermission):
    """
    Allows access only to authenticated monitoring agents.
    """
    def has_permission(self, request, view):
        return request.user and isinstance(request.auth, Server)
