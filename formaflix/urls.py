import smtplib, socket

from django.contrib import admin
from django.core.mail import send_mail, EmailMessage, get_connection
from django.http import HttpResponse, JsonResponse
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



def send_email_health(request):
    try:
        conn = get_connection(
            host=settings.EMAIL_HOST,
            port=settings.EMAIL_PORT,
            username=settings.EMAIL_HOST_USER,
            password=settings.EMAIL_HOST_PASSWORD,
            use_tls=settings.EMAIL_USE_TLS,
            use_ssl=settings.EMAIL_USE_SSL,
            timeout=getattr(settings, "EMAIL_TIMEOUT", 10),
        )
        msg = EmailMessage(
            "Formaflix SMTP health",
            "It works ✅",
            settings.DEFAULT_FROM_EMAIL,
            [settings.DEFAULT_FROM_EMAIL],  # envoi vers toi
        )
        conn.send_messages([msg])
        return JsonResponse({"ok": True})
    except smtplib.SMTPAuthenticationError as e:
        return JsonResponse({"ok": False, "type":"auth", "code":getattr(e, "smtp_code", None), "msg":str(e)}, status=500)
    except (smtplib.SMTPException, socket.error) as e:
        return JsonResponse({"ok": False, "type":"smtp", "msg":str(e)}, status=500)
    except Exception as e:
        return JsonResponse({"ok": False, "type":"other", "msg":str(e)}, status=500)

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
    path("health/send-email/", send_email_health),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)