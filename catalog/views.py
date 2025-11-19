from rest_framework import viewsets, permissions
from .models import Course, Rating
from .serializers import CourseListSerializer, CourseDetailSerializer
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rate_course(request):
    course_id = request.data.get("course_id")
    value = request.data.get("value")
    try:
        value = int(value)
    except:
        return Response({"detail": "value invalide"}, status=400)
    if value not in (-1, 1, 2):
        return Response({"detail": "value doit être -1, 1 ou 2"}, status=400)

    try:
        course = Course.objects.get(pk=course_id, is_active=True)
    except Course.DoesNotExist:
        return Response({"detail": "Cours introuvable"}, status=404)

    r, _created = Rating.objects.update_or_create(
        course=course, user=request.user, defaults={"value": value}
    )

    love_count = course.ratings.filter(value=2).count()
    ratings_total = course.ratings.exclude(value=0).count()
    love_percent = int(round(100 * love_count / ratings_total)) if ratings_total else 0

    return Response({
        "user_rating": r.value,
        "love_count": love_count,
        "ratings_total": ratings_total,
        "love_percent": love_percent,
    })