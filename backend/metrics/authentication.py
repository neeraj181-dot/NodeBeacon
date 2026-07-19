from rest_framework import authentication
from rest_framework import exceptions
from servers.models import Server

class AgentAPIKeyAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class for remote server monitoring agents.
    Authenticates requests using the 'X-API-Key' header.
    Returns 401 Unauthorized if missing or invalid.
    """
    def authenticate(self, request):
        api_key = request.META.get('HTTP_X_API_KEY')
        if not api_key:
            raise exceptions.AuthenticationFailed('API Key is required in X-API-Key header.')

        try:
            server = Server.objects.get(api_key=api_key)
        except Server.DoesNotExist:
            raise exceptions.AuthenticationFailed('Invalid API Key.')

        # Return the server owner as user, and the server instance as auth
        return (server.owner, server)

    def authenticate_header(self, request):
        # Returning a header forces Django REST Framework to return 
        # HTTP 401 Unauthorized instead of HTTP 403 Forbidden when authentication fails.
        return 'X-API-Key realm="api"'
