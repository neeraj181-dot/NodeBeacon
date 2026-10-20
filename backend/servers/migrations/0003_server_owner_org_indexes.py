from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('servers', '0002_server_department_server_location_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='server',
            index=models.Index(
                fields=['owner', '-created_at'],
                name='server_owner_created_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='server',
            index=models.Index(
                fields=['organization', '-created_at'],
                name='server_org_created_idx',
            ),
        ),
    ]
