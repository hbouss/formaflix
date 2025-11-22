# formaflix/views_smtp_test.py
import socket, smtplib
from django.conf import settings
from django.http import JsonResponse
from django.core.mail import send_mail

def smtp_ping(request):
    host = settings.EMAIL_HOST
    port = settings.EMAIL_PORT
    timeout = getattr(settings, "EMAIL_TIMEOUT", 60)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return JsonResponse({"ok": True, "host": host, "port": port})
    except Exception as e:
        return JsonResponse({"ok": False, "host": host, "port": port, "error": str(e)})

def send_test_mail(request):
    try:
        sent = send_mail(
            subject="Test SMTP Formaflix",
            message="Hello from Django via Brevo ✅",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[request.GET.get("to", settings.EMAIL_HOST_USER)],
            fail_silently=False,
        )
        return JsonResponse({"ok": True, "sent": sent})
    except Exception as e:
        return JsonResponse({"ok": False, "error": repr(e)})