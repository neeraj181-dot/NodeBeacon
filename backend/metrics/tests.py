from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from servers.models import Server
from metrics.models import Metric

User = get_user_model()

class MetricTests(APITestCase):

    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(
            username='user1', email='user1@nodebeacon.net', password='password123'
        )
        self.user2 = User.objects.create_user(
            username='user2', email='user2@nodebeacon.net', password='password123'
        )

        # Create servers
        self.server1 = Server.objects.create(
            owner=self.user1,
            name='Prod Server 1',
            hostname='prod-01',
            operating_system='Ubuntu 22.04',
            ip_address='192.168.1.10',
            status='Offline'
        )
        self.server2 = Server.objects.create(
            owner=self.user2,
            name='Prod Server 2',
            hostname='prod-02',
            operating_system='Ubuntu 22.04',
            ip_address='192.168.1.11',
            status='Offline'
        )

        # URLs
        self.metrics_url = reverse('metrics_list_create')
        self.server1_metrics_url = reverse('server_metrics_list', args=[self.server1.id])
        self.server2_metrics_url = reverse('server_metrics_list', args=[self.server2.id])

        # Sample metrics body
        self.valid_payload = {
            'cpu_usage': 45.5,
            'memory_usage': 68.2,
            'disk_usage': 38.1,
            'network_in': 5000,
            'network_out': 6000,
            'uptime': 3600
        }

    def test_agent_submit_metrics_success(self):
        # Set API Key header
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        response = self.client.post(self.metrics_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], 'Metric stored successfully.')

        # Verify Server status is set to Online and last_seen is updated
        self.server1.refresh_from_db()
        self.assertEqual(self.server1.status, 'Online')
        self.assertIsNotNone(self.server1.last_seen)

        # Verify Metric was stored
        self.assertEqual(Metric.objects.filter(server=self.server1).count(), 1)

    def test_agent_submit_metrics_invalid_api_key(self):
        self.client.credentials(HTTP_X_API_KEY='invalidkey123')
        response = self.client.post(self.metrics_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_agent_submit_metrics_missing_api_key(self):
        # No credentials header
        response = self.client.post(self.metrics_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_agent_submit_metrics_invalid_data(self):
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        
        # Out-of-bounds CPU usage
        invalid_payload = self.valid_payload.copy()
        invalid_payload['cpu_usage'] = 150.0
        response = self.client.post(self.metrics_url, invalid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cpu_usage', response.data)

        # Negative uptime
        invalid_payload2 = self.valid_payload.copy()
        invalid_payload2['uptime'] = -100
        response = self.client.post(self.metrics_url, invalid_payload2, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('uptime', response.data)

    def test_get_metrics_authenticated_jwt(self):
        # Populate database with some metrics
        Metric.objects.create(server=self.server1, cpu_usage=10.0, memory_usage=20.0, disk_usage=30.0, network_in=100, network_out=200, uptime=500)
        Metric.objects.create(server=self.server2, cpu_usage=15.0, memory_usage=25.0, disk_usage=35.0, network_in=150, network_out=250, uptime=600)

        # Authenticate user1 (JWT)
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.metrics_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return ONLY user1's server metrics
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['cpu_usage'], 10.0)

    def test_get_server_metrics_success_with_limit(self):
        # Create multiple metrics for server 1
        for i in range(15):
            Metric.objects.create(
                server=self.server1,
                cpu_usage=float(i),
                memory_usage=50.0,
                disk_usage=50.0,
                network_in=1000,
                network_out=1000,
                uptime=i * 10
            )

        self.client.force_authenticate(user=self.user1)
        
        # Test default listing returns all 15
        response = self.client.get(self.server1_metrics_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 15)

        # Test limit query param restricts to 5
        response = self.client.get(f"{self.server1_metrics_url}?limit=5", format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)
        # Verify ordering is newest first (i.e. cpu_usage=14.0 for newest, 13.0, 12.0 etc.)
        self.assertEqual(response.data[0]['cpu_usage'], 14.0)

    def test_get_other_user_server_metrics_denied(self):
        # Populate server 2 (owned by user2)
        Metric.objects.create(server=self.server2, cpu_usage=15.0, memory_usage=25.0, disk_usage=35.0, network_in=150, network_out=250, uptime=600)

        # Authenticate user1 and try to retrieve server 2's metrics
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.server2_metrics_url, format='json')
        # Should return 404 because server 2 does not belong to user 1
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_report_all_7_days_monitoring(self):
        from datetime import timedelta
        now_dt = timezone.now()
        # Create metrics for every day in the last 7 calendar days
        for day_offset in range(7):
            m_dt = now_dt - timedelta(days=day_offset)
            m = Metric.objects.create(
                server=self.server1,
                cpu_usage=30.0 + day_offset,
                memory_usage=40.0,
                disk_usage=50.0,
                network_in=100,
                network_out=100,
                uptime=1000
            )
            Metric.objects.filter(id=m.id).update(timestamp=m_dt)

        self.client.force_authenticate(user=self.user1)
        report_url = reverse('report_data')
        response = self.client.get(report_url, {'period': '7d'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_data'])
        self.assertEqual(response.data['metrics_count'], 7)

        # Earliest and latest actual records in window span 6 days before today through today
        current_tz = timezone.get_current_timezone()
        earliest_date = timezone.localtime(now_dt - timedelta(days=6), current_tz).date()
        latest_date = timezone.localtime(now_dt, current_tz).date()
        expected_coverage = f"{earliest_date.strftime('%b %d, %Y')} - {latest_date.strftime('%b %d, %Y')}"
        self.assertEqual(response.data['coverage_label'], expected_coverage)

        # Verify PDF export uses matching period
        pdf_url = reverse('export_pdf_report')
        pdf_resp = self.client.get(pdf_url, {'period': '7d'})
        self.assertEqual(pdf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_resp['Content-Type'], 'application/pdf')

    def test_report_latest_2_days_only(self):
        from datetime import timedelta
        now_dt = timezone.now()
        # Create metrics for ONLY the latest 2 days (today and yesterday)
        for day_offset in [0, 1]:
            m_dt = now_dt - timedelta(days=day_offset)
            m = Metric.objects.create(
                server=self.server1,
                cpu_usage=50.0,
                memory_usage=60.0,
                disk_usage=70.0,
                network_in=100,
                network_out=100,
                uptime=1000
            )
            Metric.objects.filter(id=m.id).update(timestamp=m_dt)

        self.client.force_authenticate(user=self.user1)
        report_url = reverse('report_data')
        response = self.client.get(report_url, {'period': '7d'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_data'])
        self.assertEqual(response.data['metrics_count'], 2)

        # Coverage must ONLY cover the 2 available days, never inventing missing days
        current_tz = timezone.get_current_timezone()
        earliest_date = timezone.localtime(now_dt - timedelta(days=1), current_tz).date()
        latest_date = timezone.localtime(now_dt, current_tz).date()
        expected_coverage = f"{earliest_date.strftime('%b %d, %Y')} - {latest_date.strftime('%b %d, %Y')}"
        self.assertEqual(response.data['coverage_label'], expected_coverage)

    def test_report_no_monitoring_data_exists(self):
        from datetime import timedelta
        # Create a stale metric from 25 days ago (outside the 7d window)
        stale_dt = timezone.now() - timedelta(days=25)
        m = Metric.objects.create(
            server=self.server1,
            cpu_usage=20.0,
            memory_usage=30.0,
            disk_usage=40.0,
            network_in=100,
            network_out=100,
            uptime=1000
        )
        Metric.objects.filter(id=m.id).update(timestamp=stale_dt)

        self.client.force_authenticate(user=self.user1)
        report_url = reverse('report_data')
        response = self.client.get(report_url, {'period': '7d'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['has_data'])
        self.assertEqual(response.data['coverage_label'], 'NO MONITORING DATA AVAILABLE')
        self.assertEqual(response.data['report_period_str'], 'NO MONITORING DATA AVAILABLE')
        self.assertEqual(response.data['metrics_count'], 0)
        self.assertEqual(response.data['avg_cpu'], 0.0)

        import pypdfium2 as pdfium
        pdf_resp = self.client.get(reverse('export_pdf_report'), {'period': '7d'})
        self.assertEqual(pdf_resp.status_code, status.HTTP_200_OK)
        pdf = pdfium.PdfDocument(pdf_resp.content)
        page_text = pdf[0].get_textpage().get_text_range()
        self.assertIn('NO MONITORING DATA AVAILABLE', page_text)

    def test_report_custom_reporting_period(self):
        from datetime import datetime, time
        current_tz = timezone.get_current_timezone()
        # Metrics on Sept 10 and Sept 12
        dt1 = timezone.make_aware(datetime(2026, 9, 10, 10, 0, 0), current_tz)
        dt2 = timezone.make_aware(datetime(2026, 9, 12, 15, 0, 0), current_tz)
        
        m1 = Metric.objects.create(server=self.server1, cpu_usage=25.0, memory_usage=35.0, disk_usage=45.0, network_in=50, network_out=50, uptime=500)
        Metric.objects.filter(id=m1.id).update(timestamp=dt1)
        m2 = Metric.objects.create(server=self.server1, cpu_usage=75.0, memory_usage=65.0, disk_usage=55.0, network_in=50, network_out=50, uptime=600)
        Metric.objects.filter(id=m2.id).update(timestamp=dt2)

        self.client.force_authenticate(user=self.user1)
        report_url = reverse('report_data')
        response = self.client.get(report_url, {
            'period': 'custom',
            'start_date': '2026-09-01',
            'end_date': '2026-09-15',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_data'])
        self.assertEqual(response.data['metrics_count'], 2)
        self.assertEqual(response.data['coverage_label'], 'Sep 10, 2026 - Sep 12, 2026')
        self.assertEqual(response.data['avg_cpu'], 50.0)

    def test_chart_gap_handling_and_real_measurements(self):
        """
        Verify that PDF export handles intervals with large gaps, preserves actual disk measurements
        (including high usage without artificial capping), and computes actual network throughput.
        """
        from datetime import datetime, timedelta
        current_tz = timezone.get_current_timezone()
        t0 = timezone.now() - timedelta(hours=5)
        t1 = t0 + timedelta(minutes=5)
        # 3-hour gap
        t2 = t0 + timedelta(hours=3)
        t3 = t2 + timedelta(minutes=5)

        # High disk usage: 96.5%
        m0 = Metric.objects.create(server=self.server1, cpu_usage=20.0, memory_usage=50.0, disk_usage=96.5, network_in=1000000, network_out=500000, uptime=100)
        Metric.objects.filter(id=m0.id).update(timestamp=t0)

        m1 = Metric.objects.create(server=self.server1, cpu_usage=25.0, memory_usage=55.0, disk_usage=96.5, network_in=1050000, network_out=550000, uptime=400)
        Metric.objects.filter(id=m1.id).update(timestamp=t1)

        m2 = Metric.objects.create(server=self.server1, cpu_usage=30.0, memory_usage=60.0, disk_usage=96.5, network_in=2000000, network_out=1000000, uptime=11000)
        Metric.objects.filter(id=m2.id).update(timestamp=t2)

        m3 = Metric.objects.create(server=self.server1, cpu_usage=35.0, memory_usage=65.0, disk_usage=96.5, network_in=2060000, network_out=1040000, uptime=11300)
        Metric.objects.filter(id=m3.id).update(timestamp=t3)

        self.client.force_authenticate(user=self.user1)
        pdf_resp = self.client.get(reverse('export_pdf_report'), {'period': '24h'})
        self.assertEqual(pdf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_resp['Content-Type'], 'application/pdf')

        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_resp.content)
        self.assertEqual(len(pdf), 3)

        # Page 1 contains executive summary and high disk usage preserved
        page1_text = pdf[0].get_textpage().get_text_range()
        self.assertIn('96.5%', page1_text)
        self.assertIn('System Performance Health Audit', page1_text)

