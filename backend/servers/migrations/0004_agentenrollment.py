from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('servers', '0003_server_owner_org_indexes'),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentEnrollment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token_hash', models.CharField(db_index=True, max_length=64, unique=True)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('server', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_enrollments', to='servers.server')),
            ],
            options={
                'indexes': [models.Index(fields=['server', 'expires_at'], name='enroll_server_exp_idx')],
            },
        ),
    ]
