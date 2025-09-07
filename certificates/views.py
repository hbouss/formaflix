import io, uuid, os
from datetime import datetime
from django.conf import settings
from django.http import FileResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from catalog.models import Course
from quizzes.models import Quiz, Submission
from learning.models import Enrollment

class GenerateCertificateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, course_id: int):
        # vérif accès
        enrollment = Enrollment.objects.filter(user=request.user, course_id=course_id).first()
        if not enrollment:
            return HttpResponseBadRequest("not enrolled")
        quiz = Quiz.objects.filter(course_id=course_id).first()
        if not quiz:
            return HttpResponseBadRequest("no quiz")
        sub = Submission.objects.filter(user=request.user, quiz=quiz, passed=True).order_by("-submitted_at").first()
        if not sub:
            return HttpResponseBadRequest("no passing submission")

        # génère un PDF simple
        code = uuid.uuid4().hex[:10].upper()
        filename = f"cert_{request.user.id}_{course_id}_{code}.pdf"
        path = os.path.join(settings.MEDIA_ROOT, "certificates")
        os.makedirs(path, exist_ok=True)
        full = os.path.join(path, filename)

        buff = io.BytesIO()
        c = canvas.Canvas(buff, pagesize=A4)
        w, h = A4
        c.setFont("Helvetica-Bold", 28)
        c.drawCentredString(w/2, h-150, "CERTIFICAT DE FORMATION")
        c.setFont("Helvetica", 16)
        c.drawCentredString(w/2, h-220, f"Délivré à : {request.user.get_username()}")
        c.drawCentredString(w/2, h-250, f"Pour le cours : {enrollment.course.title}")
        c.drawCentredString(w/2, h-280, f"Score au quiz : {sub.score_percent}%")
        c.drawCentredString(w/2, h-310, f"Date : {datetime.now().strftime('%d/%m/%Y')}")
        c.setFont("Helvetica-Oblique", 12)
        c.drawCentredString(w/2, 120, f"Code vérification : {code}")
        c.showPage()
        c.save()

        with open(full, "wb") as f:
            f.write(buff.getvalue())

        url = request.build_absolute_uri(f"{settings.MEDIA_URL}certificates/{filename}")
        return Response({"url": url})