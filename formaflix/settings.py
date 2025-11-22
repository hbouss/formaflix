from datetime import timedelta
from pathlib import Path
import os
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")  # ← charge .env

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
DEBUG = os.getenv("DEBUG", "1") == "1"

# --- ALLOWED_HOSTS robuste ---
hosts_env = os.getenv("ALLOWED_HOSTS", "")
ALLOWED_HOSTS = [h.strip() for h in hosts_env.split(",") if h.strip()]

# Valeur par défaut si rien en env
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "192.168.1.15"]

# En DEV, possibilité d’ouvrir à tout pour tests mobiles
if DEBUG and os.getenv("ALLOW_ALL_HOSTS_DEV", "1") == "1":
    ALLOWED_HOSTS = ["*"]

# (temporaire) Log pour vérifier ce que Django utilise VRAIMENT
print("DEBUG =", DEBUG)
print("ALLOWED_HOSTS =", ALLOWED_HOSTS)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "drf_spectacular",
    # apps
    "accounts",
    "catalog",
    "learning",
    "orders",
    "payments",
    "quizzes",
    "certificates",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # ← AJOUT
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --- derrière le proxy HTTPS de Railway ---
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
USE_X_FORWARDED_HOST = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
X_FRAME_OPTIONS = "DENY"

# CORS : restreint au front
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://sbeautyflix.com",
    "https://www.sbeautyflix.com",
  ]

# --- CSRF trusted origins via ENV ---
CSRF_TRUSTED_ORIGINS = [
    u.strip() for u in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if u.strip()
]

ROOT_URLCONF = "formaflix.urls"
WSGI_APPLICATION = "formaflix.wsgi.application"

DATABASES = {"default": dj_database_url.config(conn_max_age=300, ssl_require=True)}

AUTH_USER_MODEL = "accounts.User"
TIME_ZONE = "Europe/Paris"
USE_TZ = True

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],  # tu as déjà un dossier templates : parfait
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

STATIC_URL = "/static/"
MEDIA_URL = "/media/"
STATIC_ROOT = "/data/staticfiles"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "/data/media"))

STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

SIMPLE_JWT = {
    # Un access court = plus sûr. 1h est confortable côté UX.
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    # Session totale possible 24h (tant qu'on refresh régulièrement)
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    # Optionnel : on tourne le refresh à chaque refresh (meilleure sécu)
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    # Ces deux-là par défaut, mais on les fixe explicitement :
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Formaflix API",
    "VERSION": "1.0.0",
}

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

CF_STREAM_ACCOUNT_ID   = os.environ.get("CF_STREAM_ACCOUNT_ID", "")
CF_STREAM_API_TOKEN    = os.environ.get("CF_STREAM_API_TOKEN", "")
CF_STREAM_SIGNING_KID  = os.environ.get("CF_STREAM_SIGNING_KID", "")
CF_STREAM_SIGNING_KEY  = os.environ.get("CF_STREAM_SIGNING_KEY", "")
CF_STREAM_WEBHOOK_SECRET = os.getenv("CF_STREAM_WEBHOOK_SECRET", "")


# ---- Email ----
EMAIL_BACKEND = (
    "django.core.mail.backends.console.EmailBackend"
    if DEBUG else
    "django.core.mail.backends.smtp.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@tondomaine.com")

# SMTP prod (ex: Brevo/SendGrid/Mailgun) — mets ça dans Railway variables
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "1") == "1"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "0") == "1"

# Lien de destination pour le reset (ton frontend)
# ex prod: https://beautyflix.app (Pages)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Validité des liens de reset (3 jours par défaut Django) – ici 24h :
PASSWORD_RESET_TIMEOUT = int(os.getenv("PASSWORD_RESET_TIMEOUT", str(60 * 60 * 24)))