from django.urls import path, include
from rest_framework.routers import DefaultRouter
from servers.views import ServerViewSet

router = DefaultRouter()
router.register('', ServerViewSet, basename='server')

urlpatterns = [
    path('', include(router.urls)),
]
