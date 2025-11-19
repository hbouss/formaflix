from rest_framework import serializers

from integrations.cloudflare_stream import sign_playback_token, playback_hls_url
from learning.models import Lesson, Document
from learning.services.cloudflare_stream import build_hls_url
from .models import Course, Rating


class LessonSerializer(serializers.ModelSerializer):
    video_src = serializers.SerializerMethodField()

    def get_video_src(self, obj):
        request = self.context.get("request")
        # 1) Cloudflare prêt ? → on renvoie HLS
        if getattr(obj, "cf_ready", False) and getattr(obj, "cf_playback_id", ""):
            require_signed = True
            # Autoriser les previews sans signature si tu veux
            if obj.is_free_preview:
                require_signed = False

            if require_signed:
                try:
                    token = sign_playback_token(obj.cf_uid)
                    return playback_hls_url(obj.cf_playback_id, token)
                except Exception:
                    # en cas de pépin de signature, on renvoie quand même (non signé)
                    return playback_hls_url(obj.cf_playback_id, None)
            else:
                return playback_hls_url(obj.cf_playback_id, None)

        # 2) fallback fichier local
        if obj.video_file:
            url = obj.video_file.url
            return request.build_absolute_uri(url) if request else url
        # 3) fallback URL externe
        return obj.video_url or ""

    class Meta:
        model = Lesson
        fields = ["id", "title", "order", "duration_seconds", "is_free_preview", "video_src"]


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ["id", "title", "file"]


class CourseListSerializer(serializers.ModelSerializer):
    categories = serializers.SlugRelatedField(slug_field="slug", many=True, read_only=True)
    trailer_src = serializers.SerializerMethodField()

    # (Optionnel) Si tu veux afficher un badge "% ont adoré" directement sur les cards,
    # dé-commente les 3 lignes ci-dessous et ajoute-les aussi dans Meta.fields :
    # love_percent = serializers.SerializerMethodField()
    # def get_love_percent(self, obj):
    #     total = obj.ratings.exclude(value=0).count()
    #     love = obj.ratings.filter(value=2).count()
    #     return int(round(100 * love / total)) if total else 0

    def get_trailer_src(self, obj):
        from learning.services.cloudflare_stream import build_hls_url
        # Stream d'abord
        if getattr(obj, "trailer_cf_playback_id", "") and getattr(obj, "trailer_cf_ready", False):
            return build_hls_url(obj.trailer_cf_playback_id, sign=True)

        request = self.context.get("request")
        if obj.trailer_file:
            url = obj.trailer_file.url
            return request.build_absolute_uri(url) if request else url
        return obj.trailer_url or ""

    class Meta:
        model = Course
        fields = [
            "id", "title", "slug", "synopsis", "thumbnail", "trailer_src",
            "price_cents", "currency", "categories",
            # "love_percent",  # ← dé-commente si tu actives le badge en liste
        ]


class CourseDetailSerializer(serializers.ModelSerializer):
    categories = serializers.SlugRelatedField(slug_field="slug", many=True, read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    trailer_src = serializers.SerializerMethodField()

    # --- Champs d’évaluation pour l’écran détail ---
    love_count = serializers.SerializerMethodField()
    ratings_total = serializers.SerializerMethodField()
    love_percent = serializers.SerializerMethodField()
    user_rating = serializers.SerializerMethodField()  # -1, 0, 1, 2

    def get_trailer_src(self, obj):
        from learning.services.cloudflare_stream import build_hls_url
        # Stream d'abord
        if getattr(obj, "trailer_cf_playback_id", "") and getattr(obj, "trailer_cf_ready", False):
            return build_hls_url(obj.trailer_cf_playback_id, sign=True)

        request = self.context.get("request")
        if obj.trailer_file:
            url = obj.trailer_file.url
            return request.build_absolute_uri(url) if request else url
        return obj.trailer_url or ""

    def get_love_count(self, obj):
        return obj.ratings.filter(value=2).count()

    def get_ratings_total(self, obj):
        # total = nb d’utilisateurs ayant donné une note (±1 ou 2)
        return obj.ratings.exclude(value=0).count()

    def get_love_percent(self, obj):
        total = obj.ratings.exclude(value=0).count()
        love = obj.ratings.filter(value=2).count()
        return int(round(100 * love / total)) if total else 0

    def get_user_rating(self, obj):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            r = Rating.objects.filter(course=obj, user=request.user).first()
            return r.value if r else 0
        return 0

    class Meta:
        model = Course
        fields = [
            "id", "title", "slug", "synopsis", "description", "thumbnail", "hero_banner",
            "trailer_src", "price_cents", "currency", "categories", "lessons", "documents",
            # --- Stats & note utilisateur ---
            "love_count", "ratings_total", "love_percent", "user_rating",
        ]