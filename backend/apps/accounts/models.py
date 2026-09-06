from django.contrib.auth.models import AbstractUser
from django.db import models

from .validators import validate_avatar


class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True, validators=[validate_avatar])

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email
