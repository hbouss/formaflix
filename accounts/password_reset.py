# accounts/password_reset.py
import os
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()


def send_brevo_reset_email(to_email: str, reset_link: str):
    """
    Envoi de l'email via l'API HTTP Brevo (pas SMTP).
    """
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        raise RuntimeError("BREVO_API_KEY manquant")

    sender_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@sbeautyflix.com")

    payload = {
        "sender": {"name": "SBeautyflix", "email": sender_email},
        "to": [{"email": to_email}],
        "subject": "Réinitialisation de ton mot de passe - SBeautyflix",
        "htmlContent": f"""
            <html>
              <body>
                <p>Bonjour,</p>
                <p>Tu as demandé à réinitialiser ton mot de passe SBeautyflix.</p>
                <p>
                  👉 Clique sur ce lien pour définir un nouveau mot de passe :<br/>
                  <a href="{reset_link}">{reset_link}</a>
                </p>
                <p>Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.</p>
              </body>
            </html>
        """,
    }

    r = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        json=payload,
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        timeout=10,
    )
    r.raise_for_status()  # lèvera une exception si Brevo répond 4xx / 5xx


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        if not email:
            return Response(
                {"detail": "email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = User.objects.filter(email__iexact=email, is_active=True)

        if not qs.exists():
            # Réponse neutre
            return Response(
                {"detail": "If an account exists, an email has been sent."},
                status=status.HTTP_200_OK,
            )

        user = qs.order_by("id").first()

        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        frontend_base = getattr(settings, "FRONTEND_URL", None) \
                        or os.getenv("FRONTEND_BASE_URL", "").strip() \
                        or "https://formaflix.vercel.app"

        reset_link = f"{frontend_base}/reset-password?uid={uidb64}&token={token}"

        # 🔥 ICI on utilise l’API Brevo au lieu du SMTP Django
        try:
            send_brevo_reset_email(email, reset_link)
        except Exception as e:
            import logging, traceback
            logging.exception("BREVO RESET EMAIL ERROR")
            traceback.print_exc()
            # On renvoie quand même 200 pour ne pas exposer l'erreur aux utilisateurs
            return Response(
                {"detail": "If an account exists, an email has been sent."},
                status=status.HTTP_200_OK,
            )

        return Response(
            {"detail": "If an account exists, an email has been sent."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    """
    POST /api/auth/password/reset/
    body: { "uid": "...", "token": "...", "password": "newpass" }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")

        if not uidb64 or not token or not password:
            return Response(
                {"detail": "uid, token and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid, is_active=True)
        except Exception:
            return Response(
                {"detail": "Invalid reset link"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save(update_fields=["password"])

        return Response({"detail": "Password has been reset successfully."})