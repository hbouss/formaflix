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
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "formaflix.urls"
WSGI_APPLICATION = "formaflix.wsgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
    )
}

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
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"

CORS_ALLOW_ALL_ORIGINS = True

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