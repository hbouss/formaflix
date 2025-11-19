# catalog/models.py
from django.conf import settings
from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    def __str__(self): return self.name

class Course(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    synopsis = models.CharField(max_length=280, blank=True)
    description = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to="thumbnails/", blank=True)
    hero_banner = models.ImageField(upload_to="banners/", blank=True)

    # Trailers
    trailer_url = models.URLField(blank=True)
    trailer_file = models.FileField(upload_to="trailers/", blank=True)

    # Cloudflare Stream pour la bande-annonce
    trailer_cf_uid = models.CharField(max_length=64, blank=True, db_index=True)
    trailer_cf_playback_id = models.CharField(max_length=64, blank=True)
    trailer_cf_ready = models.BooleanField(default=False)

    price_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=10, default="eur")

    categories = models.ManyToManyField(Category, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Rails éditoriales
    is_editor_pick = models.BooleanField(default=False)
    editor_pick_weight = models.PositiveSmallIntegerField(default=0)
    is_full_pack = models.BooleanField(default=False)
    pack_weight = models.PositiveSmallIntegerField(default=0)
    top10_rank = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self): return self.title

class Rating(models.Model):
    """-1: pas pour moi, 1: j'aime bien, 2: j'adore"""
    course = models.ForeignKey(Course, related_name="ratings", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="course_ratings", on_delete=models.CASCADE)
    value = models.SmallIntegerField(choices=[(-1, "down"), (1, "up"), (2, "love")])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("course", "user")

    def __str__(self):
        return f"{self.user_id} -> {self.course_id} = {self.value}"