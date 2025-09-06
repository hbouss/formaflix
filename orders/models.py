# orders/models.py
from django.conf import settings
from django.db import models
from catalog.models import Course

class Order(models.Model):
    STATUS = [("pending", "pending"), ("paid", "paid"), ("failed", "failed")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders"
    )
    total_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=10, default="eur")
    stripe_session_id = models.CharField(max_length=255, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.pk} - {self.user} - {self.status}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="order_items")
    unit_amount_cents = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.course} x{self.quantity} ({self.unit_amount_cents}c)"