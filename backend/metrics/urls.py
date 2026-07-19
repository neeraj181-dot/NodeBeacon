from django.urls import path
from metrics.views import MetricsListCreateView, ServerMetricsListView

urlpatterns = [
    path('metrics/', MetricsListCreateView.as_view(), name='metrics_list_create'),
    path('servers/<int:server_id>/metrics/', ServerMetricsListView.as_view(), name='server_metrics_list'),
]
