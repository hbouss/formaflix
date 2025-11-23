# accounts/password_reset.py
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()


class ForgotPasswordView(APIView):
    """
    POST /api/auth/password/forgot/
    body: { "email": "user@example.com" }

    Répond toujours 200 (si tout va bien côté code),
    sans dire si l'email existe ou pas.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        if not email:
            return Response(
                {"detail": "email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # on ne lève JAMAIS MultipleObjectsReturned
        qs = User.objects.filter(email__iexact=email, is_active=True)

        if not qs.exists():
            # réponse neutre : on ne révèle pas si l'email existe
            return Response(
                {"detail": "If an account exists, an email has been sent."},
                status=status.HTTP_200_OK,
            )

        # s'il y a plusieurs comptes, on prend le plus ancien
        user = qs.order_by("id").first()

        # Génération uid / token standard Django
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        # URL du front pour le lien de reset
        frontend_base = getattr(settings, "FRONTEND_URL", None) \
                        or os.getenv("FRONTEND_BASE_URL", "").strip() \
                        or "https://formaflix.vercel.app"

        reset_link = f"{frontend_base}/reset-password?uid={uidb64}&token={token}"

        subject = "Réinitialisation de ton mot de passe - SBeautyflix"
        message = (
            "Bonjour,\n\n"
            "Tu as demandé à réinitialiser ton mot de passe SBeautyflix.\n\n"
            f"👉 Clique sur ce lien pour définir un nouveau mot de passe :\n{reset_link}\n\n"
            "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email."
        )

        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception as e:
            # On renvoie le détail en JSON pour t'aider à débug
            import traceback, logging
            logging.exception("FORGOT PASSWORD SMTP ERROR")
            traceback.print_exc()
            return Response(
                {"detail": f"{e.__class__.__name__}: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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