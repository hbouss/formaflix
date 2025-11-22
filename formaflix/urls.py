from django.contrib import admin
from django.core.mail import send_mail
from django.http import HttpResponse
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.auth import EmailTokenObtainPairView
from accounts.views import RegisterView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Importe tes vues API
from catalog.views import CourseViewSet, home_rails, rate_course
from certificates.views import GenerateCertificateView, GetMyCertificateView
from learning.views import MyLibraryView, MyListView, ProgressUpsertView, ContinueWatchingView, \
    TrackDocumentDownloadView, OpenDocumentView
from learning.views_cf import cf_stream_webhook
from learning.views_docs import DocumentOpenView
from payments.views import create_checkout_session, checkout_session_status
from payments.webhooks import stripe_webhook

from django.conf import settings
from django.conf.urls.static import static

from quizzes.views import QuizDetailView, QuizSubmitView

router = DefaultRouter()
router.register(r"catalog/courses", CourseViewSet, basename="course")


def ping_email(request):
    send_mail(
        subject="Test Brevo SMTP",
        message="Ça marche ✅",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=["hichem.boussouar@gmail.com"],  # remplace par ton adresse
        fail_silently=False,
    )
    return HttpResponse("Email envoyé")

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
    path("api/auth/", include("accounts.urls")),
    path("api/auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
# Learning
    path("api/learning/my-library/", MyLibraryView.as_view()),
    path("api/learning/my-list/", MyListView.as_view()),
    path("api/learning/progress/", ProgressUpsertView.as_view()),
    path("api/learning/continue-watching/", ContinueWatchingView.as_view()),
    path("api/catalog/rate/", rate_course),
    path("api/stream/webhook/", cf_stream_webhook),
    path("webhooks/cf-stream/<slug:secret>/", cf_stream_webhook, name="cf_stream_webhook"),
    # Quiz
    path("api/quizzes/<int:course_id>/", QuizDetailView.as_view()),
    path("api/quizzes/<int:course_id>/submit/", QuizSubmitView.as_view()),
    # Certificates
    path("api/learning/documents/<int:doc_id>/track/", TrackDocumentDownloadView.as_view()),
    path("api/learning/documents/<int:doc_id>/open/",  DocumentOpenView.as_view()),  # ⬅️ ajoute ça
    path("api/learning/documents/<int:doc_id>/open/", OpenDocumentView.as_view()),
    path("api/certificates/<int:course_id>/generate/", GenerateCertificateView.as_view()),
    path("api/certificates/<int:course_id>/mine/", GetMyCertificateView.as_view()),
    path("api/catalog/home-rails/", home_rails),
    path("health/send-email/", ping_email),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)