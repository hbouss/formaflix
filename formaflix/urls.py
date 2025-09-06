from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from accounts.views import RegisterView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Importe tes vues API
from catalog.views import CourseViewSet
from learning.views import MyLibraryView
from payments.views import create_checkout_session, checkout_session_status
from payments.webhooks import stripe_webhook

from django.conf import settings
from django.conf.urls.static import static

router = DefaultRouter()
router.register(r"catalog/courses", CourseViewSet, basename="course")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/", include(router.urls)),
    path("api/learning/my-library/", MyLibraryView.as_view()),
    path("api/payments/create-checkout-session/", create_checkout_session),
    path("api/payments/session-status/", checkout_session_status),
    path("api/payments/webhook/", stripe_webhook),
    path("api/auth/register/", RegisterView.as_view()),
    path("api/auth/token/", TokenObtainPairView.as_view()),
    path("api/auth/token/refresh/", TokenRefreshView.as_view()),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)