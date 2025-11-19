# accounts/urls.py
from django.urls import path
from .views import RegisterView
from .password_reset import ForgotPasswordView, ResetPasswordView
from .auth import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Auth existante
    path("register/", RegisterView.as_view(), name="register"),
    path("token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Mot de passe oublié / reset
    path("password/forgot/", ForgotPasswordView.as_view(), name="password_forgot"),
    path("password/reset/", ResetPasswordView.as_view(), name="password_reset"),
]