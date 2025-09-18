from rest_framework import viewsets, permissions
from .models import Course
from .serializers import CourseListSerializer, CourseDetailSerializer
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.filter(is_active=True).order_by("-created_at")
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        return CourseDetailSerializer if self.action == "retrieve" else CourseListSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def home_rails(request):
    now = timezone.now()
    since = now - timedelta(days=90)
    base = Course.objects.filter(is_active=True)

    # Coups de cœur (éditorial)
    editor = base.filter(is_editor_pick=True).order_by("-editor_pick_weight", "-created_at")[:20]

    # Packs complets
    packs = base.filter(is_full_pack=True).order_by("-pack_weight", "-created_at")[:20]

    # Top 10 : manuel si des rangs sont posés, sinon auto par ventes récentes
    manual_top = list(base.exclude(top10_rank__isnull=True).order_by("top10_rank")[:10])
    if manual_top:
        top10 = manual_top
    else:
        top10 = (base
                 .annotate(sales=Count("enrollments", filter=Q(enrollments__purchased_at__gte=since)))
                 .order_by("-sales", "-created_at"))[:10]

    # Les plus vendues (tendance large)
    bestsellers = (base
                   .annotate(sales=Count("enrollments"))
                   .order_by("-sales", "-created_at"))[:20]

    ser = lambda qs: CourseListSerializer(qs, many=True, context={"request": request}).data
    return Response({
        "editor_picks": ser(editor),
        "top10": ser(top10),
        "packs": ser(packs),
        "bestsellers": ser(bestsellers),
    })