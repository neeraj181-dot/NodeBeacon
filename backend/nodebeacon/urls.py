"""
URL configuration for nodebeacon project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def api_root_view(request):
    return JsonResponse({
        "status": "success",
        "message": "NodeBeacon Backend API is running",
        "version": "1.0.0"
    })

def download_agent_view(request):
    return JsonResponse({'detail': 'Log in and select a device in Download Agent to obtain its complete Windows setup package.'}, status=410)

urlpatterns = [
    path('', api_root_view, name='api_root'),
    path('api/agent/download/', download_agent_view, name='download_agent'),
    path('admin/', admin.site.urls),

    path('api/', include('users.urls')),
    path('api/servers/', include('servers.urls')),

    path('api/', include('metrics.urls')),
    path('api/alerts/', include('alerts.urls')),
]





