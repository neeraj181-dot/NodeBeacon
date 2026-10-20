from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('alerts', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='alert',
            index=models.Index(
                fields=['server', 'status'],
                name='alert_server_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='alert',
            index=models.Index(
                fields=['status', '-created_at'],
                name='alert_status_created_idx',
            ),
        ),
    ]
