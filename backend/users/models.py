from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Having a custom User model inheriting from AbstractUser
    # allows us to add fields (like avatar, role, api keys) later without breaking migrations.
    email = models.EmailField(unique=True)

    # Use email for login instead of username if desired, but we'll stick to Django defaults
    # while allowing email uniqueness.
    
    def __str__(self):
        return self.email
