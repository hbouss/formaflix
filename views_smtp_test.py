# core/views_smtp.py
from django.conf import settings
from django.core.mail import get_connection, send_mail
from django.http import JsonResponse

def smtp_ping(request):
    try:
        with get_connection(
            host=settings.EMAIL_HOST,
            port=settings.EMAIL_PORT,
            username=settings.EMAIL_HOST_USER,
            password=settings.EMAIL_HOST_PASSWORD,
            use_tls=settings.EMAIL_USE_TLS,
            timeout=getattr(settings, "EMAIL_TIMEOUT", 30),
        ) as conn:
            conn.open()  # force le handshake
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

def smtp_send(request):
    to = request.GET.get("to", "hichem.boussouar@gmail.com")
    try:
        n = send_mail(
            subject="SMTP test Formaflix",
            message="Hello depuis Railway via Brevo ✅",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to],
            fail_silently=False,
        )
        return JsonResponse({"sent": n, "to": to})
    except Exception as e:
        return JsonResponse({"sent": 0, "error": str(e)}, status=500)