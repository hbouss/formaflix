# accounts/password_reset.py
import os
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings

User = get_user_model()
token_generator = PasswordResetTokenGenerator()

def _frontend_base() -> str:
    # URL front où vit ton React (Pages, localhost, ...)
    return os.getenv("FRONTEND_URL", "http://localhost:5173")

def _send_reset_email(email: str, reset_url: str):
    subject = "Réinitialisation de votre mot de passe"
    text = (
        "Bonjour,\n\n"
        "Vous avez demandé la réinitialisation de votre mot de passe.\n"
        f"Cliquez sur ce lien pour définir un nouveau mot de passe :\n{reset_url}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email."
    )
    html = (
        f"<p>Bonjour,</p>"
        f"<p>Vous avez demandé la réinitialisation de votre mot de passe.</p>"
        f"<p><a href='{reset_url}'>Cliquez ici pour définir un nouveau mot de passe</a></p>"
        f"<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>"
    )
    msg = EmailMultiAlternatives(subject, text, to=[email])
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=True)

class ForgotPasswordView(APIView):
    """
    POST { "email": "user@example.com" }
    -> 200 toujours (ne révèle pas si l'email existe)
    Envoie un email avec lien: {FRONTEND_URL}/reset-password?uid=...&token=...
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        if email:
            try:
                user = User.objects.get(email__iexact=email, is_active=True)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = token_generator.make_token(user)
                reset_url = f"{_frontend_base().rstrip('/')}/reset-password?uid={uid}&token={token}"

                if settings.DEBUG:
                    print(f"[DEV] Password reset link: {reset_url}")
                    return Response({"ok": True, "uid": uid, "token": token, "reset_url": reset_url}, status=200)

                _send_reset_email(user.email, reset_url)
            except User.DoesNotExist:
                pass  # même réponse, pour ne rien dévoiler
        return Response({"ok": True}, status=status.HTTP_200_OK)

class ResetPasswordView(APIView):
    """
    POST { "uid": "...", "token": "...", "password": "newPassword123" }
    -> 204 si ok, 400 si token invalide
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = (request.data.get("new_password")
                        or request.data.get("password")
                        or "")
        if not (uid and token and new_password):
            return Response({"detail": "uid, token et password requis"}, status=400)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk, is_active=True)
        except Exception:
            return Response({"detail": "Lien invalide"}, status=400)

        if not token_generator.check_token(user, token):
            return Response({"detail": "Lien expiré ou invalide"}, status=400)

        # (Option) : applique tes password validators si configurés
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)