from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('metrics', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='metric',
            index=models.Index(
                fields=['server', '-timestamp'],
                name='metric_server_time_idx',
            ),
        ),
    ]
