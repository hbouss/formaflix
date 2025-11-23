# accounts/password_reset.py
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

User = get_user_model()


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            email = (request.data.get("email") or "").strip().lower()
            if not email:
                return Response({"detail": "email is required"}, status=status.HTTP_400_BAD_REQUEST)

            try:
                user = User.objects.get(email__iexact=email, is_active=True)
            except User.DoesNotExist:
                # On ne révèle pas si l'email existe ou pas
                return Response({"detail": "If an account exists, an email has been sent."})

            # Génération du token
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            reset_link = f"{base}/reset-password?uid={uidb64}&token={token}"

            subject = "Réinitialisation de ton mot de passe SBeautyflix"
            message = (
                "Bonjour,\n\n"
                "Tu as demandé à réinitialiser ton mot de passe sur SBeautyflix.\n"
                "Clique sur le lien ci-dessous (ou copie-colle-le dans ton navigateur) :\n\n"
                f"{reset_link}\n\n"
                "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.\n\n"
                "L'équipe SBeautyflix"
            )

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,  # très important : on laisse remonter l'erreur
            )

            return Response({"detail": "If an account exists, an email has been sent."})
        except Exception as e:
            # On log dans les logs Railway
            import traceback
            traceback.print_exc()

            # Et on RENVOIE le message au front pour que tu le voies dans Network
            return Response(
                {"detail": f"{e.__class__.__name__}: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            uidb64 = request.data.get("uid")
            token = request.data.get("token")
            password = request.data.get("password")

            if not uidb64 or not token or not password:
                return Response(
                    {"detail": "uid, token and password are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid, is_active=True)

            if not default_token_generator.check_token(user, token):
                return Response({"detail": "invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(password)
            user.save(update_fields=["password"])

            return Response({"detail": "password reset ok"})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"{e.__class__.__name__}: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )