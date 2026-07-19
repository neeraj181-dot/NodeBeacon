from django.urls import path
from metrics.views import MetricsListCreateView, ServerMetricsListView, ExportPDFReportView

urlpatterns = [
    path('metrics/', MetricsListCreateView.as_view(), name='metrics_list_create'),
    path('metrics/export-pdf/', ExportPDFReportView.as_view(), name='export_pdf_report'),
    path('servers/<int:server_id>/metrics/', ServerMetricsListView.as_view(), name='server_metrics_list'),
]
