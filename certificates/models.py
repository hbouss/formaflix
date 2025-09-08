# certificates/models.py
from django.conf import settings
from django.db import models
from catalog.models import Course

class Certificate(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="certificates")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="certificates")
    filename = models.CharField(max_length=200)  # ex: "cert_1_5_ABCDEF.pdf"
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "course", "filename")