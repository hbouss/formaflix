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

    # — Rails éditoriales pour la Home —
    is_editor_pick = models.BooleanField(
        default=False, help_text="Prochain coup de cœur (rail éditorial)."
    )
    editor_pick_weight = models.PositiveSmallIntegerField(
        default=0, help_text="Priorité d’affichage (0 = auto)."
    )

    is_full_pack = models.BooleanField(
        default=False, help_text="Afficher dans la rangée 'Packs complets'."
    )
    pack_weight = models.PositiveSmallIntegerField(
        default=0, help_text="Priorité d’affichage (0 = auto)."
    )

    top10_rank = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="1..10 pour forcer l’ordre du 'Top 10'."
    )

    def __str__(self):
        return self.title