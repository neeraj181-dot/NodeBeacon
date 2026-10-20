"""Enrollment and configuration for authorized NodeBeacon installations."""
import hashlib
import io
import ipaddress
import json
import re
import secrets
import uuid
import zipfile
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from servers.models import AgentEnrollment, Server


def digest(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def normalize_origin(value):
    value = value.strip()
    if '://' not in value:
        value = 'http://' + value
    try:
        url = urlsplit(value)
        port = url.port
        host = url.hostname
        if url.scheme not in ('http', 'https') or not host or url.username or url.password:
            raise ValueError()
        if url.path not in ('', '/') or url.query or url.fragment:
            raise ValueError()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            if re.fullmatch(r'[0-9.]+', host):
                raise ValueError()
            if not re.fullmatch(r'(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', host):
                raise ValueError()
            if any(not label or len(label) > 63 or label.startswith('-') or label.endswith('-') for label in host.split('.')):
                raise ValueError()
        if port is not None and not 1 <= port <= 65535:
            raise ValueError()
        return value.rstrip('/')
    except ValueError:
        raise serializers.ValidationError('Enter an HTTP/HTTPS host or IP without credentials, path, query, or fragment.')


class ConfigSerializer(serializers.Serializer):
    server_url = serializers.CharField(max_length=255)
    server_port = serializers.IntegerField(min_value=1, max_value=65535, allow_null=True, required=False)

    def validate(self, attrs):
        origin = normalize_origin(attrs['server_url'])
        parsed = urlsplit(origin)
        port = attrs.get('server_port') or parsed.port
        host = parsed.hostname
        host = f'[{host}]' if ':' in host else host
        attrs['server_url'] = f'{parsed.scheme}://{host}'
        attrs['server_port'] = port
        return attrs


def public_origin(request):
    return normalize_origin(getattr(settings, 'AGENT_PUBLIC_URL', '') or request.build_absolute_uri('/'))


def configuration(server):
    origin = server.agent_server_url
    if server.agent_server_port:
        origin += f':{server.agent_server_port}'
    return {
        'device_id': str(server.device_id), 'device_name': server.name,
        'server_url': server.agent_server_url, 'server_port': server.agent_server_port,
        'metrics_url': origin + '/api/metrics/', 'config_version': server.config_version,
        'interval': 10,
    }


def owned_server(request, pk):
    # Device management is owner-only, even if fleet metrics are shared with an organization.
    return get_object_or_404(Server, pk=pk, owner=request.user)


class DeviceAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.headers.get('X-Device-Token', '')
        server = Server.objects.filter(device_token_hash=digest(token)).select_related('owner').first() if token else None
        if not server or not server.owner.is_active:
            raise AuthenticationFailed('Invalid device credential.')
        return server.owner, server

    def authenticate_header(self, request):
        return 'Device'


class EnrollmentThrottle(AnonRateThrottle):
    rate = '20/min'


class DownloadAgentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        server = owned_server(request, pk)
        if server.device_token_hash:
            return Response({'detail': 'This device is already enrolled. Use its installed application; contact the owner before replacing it.'}, status=409)
        package = settings.BASE_DIR.parent / 'agent' / 'dist' / 'NodeBeaconAgent'
        exe = package / 'NodeBeaconAgent.exe'
        if not exe.is_file():
            return Response({'detail': 'Build the Windows installer first.'}, status=503)
        origin = public_origin(request)
        with transaction.atomic():
            server = Server.objects.select_for_update().get(pk=server.pk)
            if server.device_token_hash:
                return Response({'detail': 'Device already enrolled.'}, status=409)
            if not server.device_id:
                server.device_id = uuid.uuid4()
            if not server.agent_server_url:
                parsed = ConfigSerializer(data={'server_url': origin})
                parsed.is_valid(raise_exception=True)
                server.agent_server_url = parsed.validated_data['server_url']
                server.agent_server_port = parsed.validated_data['server_port']
            server.save(update_fields=['device_id', 'agent_server_url', 'agent_server_port'])
            # Re-downloading invalidates previous unused packages.
            server.agent_enrollments.filter(used_at=None).update(used_at=timezone.now())
            token = secrets.token_urlsafe(32)
            AgentEnrollment.objects.create(server=server, token_hash=digest(token), expires_at=timezone.now() + timedelta(minutes=30))
        bootstrap = {'management_url': origin, 'enrollment_token': token, 'device_id': str(server.device_id), 'device_name': server.name}
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
            for item in package.rglob('*'):
                if item.is_file():
                    archive.write(item, item.relative_to(package).as_posix())
            archive.writestr('enrollment.json', json.dumps(bootstrap, indent=2))
            archive.writestr('READ-ME.txt', 'Extract all files, then open NodeBeaconAgent.exe. Approve installation for your authorized PC. Install within 30 minutes. Keep this package private.\n')
        buffer.seek(0)
        response = FileResponse(buffer, as_attachment=True, filename=f'NodeBeacon-{server.pk}-Setup.zip', content_type='application/zip')
        response['Cache-Control'] = 'no-store'
        return response


class RegisterAgentView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [EnrollmentThrottle]

    def post(self, request):
        token = request.data.get('token', '')
        if not isinstance(token, str) or not 20 <= len(token) <= 200:
            return Response({'detail': 'Invalid enrollment token.'}, status=401)
        with transaction.atomic():
            entry = AgentEnrollment.objects.select_for_update().select_related('server').filter(token_hash=digest(token)).first()
            if not entry or entry.used_at or entry.expires_at <= timezone.now():
                return Response({'detail': 'Enrollment expired or already used. Download a new package.'}, status=401)
            server = Server.objects.select_for_update().get(pk=entry.server_id)
            if server.device_token_hash or not server.owner.is_active:
                return Response({'detail': 'Device cannot be enrolled.'}, status=409)
            device_token = secrets.token_urlsafe(32)
            server.device_token_hash = digest(device_token)
            server.agent_status = 'Registered'
            server.save(update_fields=['device_token_hash', 'agent_status'])
            entry.used_at = timezone.now()
            entry.save(update_fields=['used_at'])
            data = configuration(server)
        response = Response({**data, 'device_token': device_token}, status=201)
        response['Cache-Control'] = 'no-store'
        return response


class ManageConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response(configuration(owned_server(request, pk)))

    def patch(self, request, pk):
        serializer = ConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            server = Server.objects.select_for_update().get(pk=owned_server(request, pk).pk)
            server.agent_server_url = serializer.validated_data['server_url']
            server.agent_server_port = serializer.validated_data['server_port']
            server.config_version += 1
            server.save(update_fields=['agent_server_url', 'agent_server_port', 'config_version'])
        return Response(configuration(server))


class DeviceConfigView(APIView):
    authentication_classes = [DeviceAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(configuration(request.auth))


class ResetAgentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.data.get('confirm') is not True:
            return Response({'detail': 'Explicit confirmation is required to revoke the old installation.'}, status=400)
        with transaction.atomic():
            server = Server.objects.select_for_update().get(pk=owned_server(request, pk).pk)
            server.device_token_hash = ''
            server.api_key = secrets.token_hex(24)
            server.agent_status = 'Not installed'
            server.agent_last_seen = None
            server.agent_version = ''
            server.config_version += 1
            server.save(update_fields=['device_token_hash', 'api_key', 'agent_status', 'agent_last_seen', 'agent_version', 'config_version'])
            server.agent_enrollments.filter(used_at=None).update(used_at=timezone.now())
        return Response({'detail': 'Old credentials revoked. Stop/uninstall the old agent, then download a new setup package. Historical metrics are preserved.'})


class DeviceHeartbeatView(DeviceConfigView):
    def post(self, request):
        state = request.data.get('status')
        if state not in ('Connected', 'Reconnecting', 'Stopped'):
            return Response({'detail': 'Invalid agent status.'}, status=400)
        server = request.auth
        server.agent_status = state
        server.agent_last_seen = timezone.now()
        version = request.data.get('version', '')
        server.agent_version = str(version)[:30]
        server.save(update_fields=['agent_status', 'agent_last_seen', 'agent_version'])
        return Response({'status': state})
