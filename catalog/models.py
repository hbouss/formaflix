from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


class Course(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    synopsis = models.CharField(max_length=280, blank=True)  # texte court pour le hover
    description = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to="thumbnails/", blank=True)
    trailer_url = models.URLField(blank=True)  # URL d'extrait (preview)
    hero_banner = models.ImageField(upload_to="banners/", blank=True)

    # 👉 trailers
    trailer_url = models.URLField(blank=True)  # externe (optionnel)
    trailer_file = models.FileField(upload_to="trailers/", blank=True)  # local (nouveau)

    price_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=10, default="eur")

    categories = models.ManyToManyField(Category, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title