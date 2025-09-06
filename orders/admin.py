from django.contrib import admin
from .models import Order, OrderItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "total_cents", "currency", "created_at")
    list_filter = ("status", "currency", "created_at")
    search_fields = ("id", "user__username", "user__email", "stripe_session_id")
    inlines = [OrderItemInline]

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "course", "unit_amount_cents", "quantity")