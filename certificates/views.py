# certificates/api.py
import uuid, os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.http import HttpResponseBadRequest
from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from certificates.models import Certificate
from quizzes.models import Quiz, Submission
from learning.models import Enrollment

from PIL import Image, ImageDraw, ImageFont

APP_DIR = Path(__file__).resolve().parent

CERT_TEMPLATE_PATH = APP_DIR / "assets" / "sbeauty_certificate.jpg"
FONT_BOLD_PATH = APP_DIR / "assets" / "fonts" / "PlayfairDisplay-Bold.ttf"

def _fit_font(draw, text: str, font_path: str, max_width_px: int, start_size: int, min_size: int = 26):
    size = start_size
    while size >= min_size:
        font = ImageFont.truetype(font_path, size=size)
        w = draw.textbbox((0, 0), text, font=font)[2]
        if w <= max_width_px:
            return font
        size -= 2
    return ImageFont.truetype(font_path, size=min_size)

def _draw_centered(draw, img_w: int, y: int, text: str, font, fill=(0, 0, 0)):
    w = draw.textbbox((0, 0), text, font=font)[2]
    x = (img_w - w) // 2
    draw.text((x, y), text, font=font, fill=fill)

def _user_display_name(user) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first or last:
        if first: first = first.capitalize()
        if last:  last = last.upper()
        return (first + " " + last).strip()
    full = (getattr(user, "get_full_name", lambda: "")() or "").strip()
    if full: return full
    username = (user.email or user.get_username() or "Apprenant").split("@")[0]
    return username

class GenerateCertificateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, course_id: int):
        enrollment = Enrollment.objects.filter(user=request.user, course_id=course_id).first()
        if not enrollment:
            return HttpResponseBadRequest("not enrolled")
        quiz = Quiz.objects.filter(course_id=course_id).first()
        if not quiz:
            return HttpResponseBadRequest("no quiz")
        sub = Submission.objects.filter(user=request.user, quiz=quiz, passed=True).order_by("-submitted_at").first()
        if not sub:
            return HttpResponseBadRequest("no passing submission")

        existing = Certificate.objects.filter(user=request.user, course_id=course_id).order_by("-created_at").first()
        if existing and existing.filename.lower().endswith((".jpg", ".jpeg")):
            url = request.build_absolute_uri(f"{settings.MEDIA_URL}certificates/{existing.filename}")
            return Response({"url": url})

        if not os.path.exists(CERT_TEMPLATE_PATH):
            return HttpResponseBadRequest("template not found")

        img = Image.open(CERT_TEMPLATE_PATH).convert("RGB")
        draw = ImageDraw.Draw(img)
        W, H = img.size

        # ---------- 1) NOM : un peu plus petit + plus bas ----------
        full_name = _user_display_name(request.user)
        max_w = int(W * 0.78)
        # ancien ~0.065 -> plus petit: 0.055
        base_name_size = max(42, int(W * 0.055))
        try:
            font_name = _fit_font(draw, full_name, FONT_BOLD_PATH, max_w, base_name_size)
        except OSError:
            font_name = ImageFont.load_default()

        # plus d'espace sous "ATTESTE QUE" => descendre (ex: 0.57)
        y_name = int(H * 0.57)
        _draw_centered(draw, W, y_name, full_name, font_name, fill=(0, 0, 0))

        # ---------- 2) TITRE DE LA FORMATION : sur la ligne pointillée ----------
        course_title = enrollment.course.title
        max_w_course = int(W * 0.78)
        base_course_size = max(34, int(W * 0.045))  # plus petit que le nom
        try:
            font_course = _fit_font(draw, course_title, FONT_BOLD_PATH, max_w_course, base_course_size, min_size=24)
        except OSError:
            font_course = ImageFont.load_default()

        # placer sur la ligne pointillée sous "a suivi avec succès le module de cours"
        # ajuste finement ce ratio si nécessaire pour tomber pile sur tes pointillés
        y_course = int(H * 0.705)
        _draw_centered(draw, W, y_course, course_title, font_course, fill=(0, 0, 0))

        # ---------- 3) DATE (Europe/Paris) dans la zone "Délivré par SBEAUTY Le …" ----------
        paris_now = datetime.now(ZoneInfo("Europe/Paris"))
        date_str = paris_now.strftime("%d/%m/%Y")
        try:
            font_date = ImageFont.truetype(FONT_BOLD_PATH, max(22, int(W * 0.024)))
        except OSError:
            font_date = ImageFont.load_default()

        # position à droite de "Le" – ajuste finement si besoin
        x_date = int(W * 0.78)
        y_date = int(H * 0.885)
        draw.text((x_date, y_date), date_str, font=font_date, fill=(0, 0, 0))

        # ---------- Sauvegarde ----------
        code = uuid.uuid4().hex[:10].upper()
        filename = f"cert_{request.user.id}_{course_id}_{code}.jpg"
        folder = os.path.join(settings.MEDIA_ROOT, "certificates")
        os.makedirs(folder, exist_ok=True)
        full_path = os.path.join(folder, filename)
        img.save(full_path, format="JPEG", quality=92)

        Certificate.objects.create(user=request.user, course_id=course_id, filename=filename)
        url = request.build_absolute_uri(f"{settings.MEDIA_URL}certificates/{filename}")
        return Response({"url": url})

class GetMyCertificateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id: int):
        cert = Certificate.objects.filter(user=request.user, course_id=course_id).order_by("-created_at").first()
        if not cert:
            return Response({"detail": "no certificate"}, status=404)
        url = request.build_absolute_uri(f"{settings.MEDIA_URL}certificates/{cert.filename}")
        return Response({"url": url})