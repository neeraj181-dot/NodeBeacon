from django.urls import path, include
from rest_framework.routers import DefaultRouter
from servers.views import ServerViewSet
from servers.agent_api import DownloadAgentView, RegisterAgentView, ManageConfigView, DeviceConfigView, DeviceHeartbeatView, ResetAgentView

router = DefaultRouter()
router.register('', ServerViewSet, basename='server')

urlpatterns = [
    path('agents/register/', RegisterAgentView.as_view(), name='agent-register'),
    path('agents/config/', DeviceConfigView.as_view(), name='agent-config'),
    path('agents/heartbeat/', DeviceHeartbeatView.as_view(), name='agent-heartbeat'),
    path('<int:pk>/agent-download/', DownloadAgentView.as_view(), name='agent-download'),
    path('<int:pk>/agent-config/', ManageConfigView.as_view(), name='agent-manage-config'),
    path('<int:pk>/agent-reset/', ResetAgentView.as_view(), name='agent-reset'),
    path('', include(router.urls)),
]
