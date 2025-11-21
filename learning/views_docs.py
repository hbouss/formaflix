# learning/views_docs.py
import os
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Document, Enrollment

class DocumentOpenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id: int):
        doc = get_object_or_404(Document, pk=doc_id)

        # Accès réservé aux inscrits au cours
        if not Enrollment.objects.filter(user=request.user, course=doc.course).exists():
            return Response({"detail": "not enrolled"}, status=403)

        fpath = doc.file.path
        if not os.path.exists(fpath):
            raise Http404

        resp = FileResponse(open(fpath, "rb"), content_type="application/pdf")
        filename = os.path.basename(fpath)

        # inline par défaut (prévisualisation). Forcer le download avec ?download=1
        if request.GET.get("download") == "1":
            resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        else:
            resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp