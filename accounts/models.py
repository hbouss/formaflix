from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # extensible: avatar, entreprise, etc.
    pass