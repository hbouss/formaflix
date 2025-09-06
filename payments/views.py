# payments/views.py
import os, stripe
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from catalog.models import Course
from orders.models import Order, OrderItem

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    course_id = request.data.get("course_id")
    if not course_id:
        return Response({"detail": "course_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        course = Course.objects.get(pk=course_id, is_active=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    order = Order.objects.create(
        user=request.user,
        total_cents=course.price_cents,
        currency=course.currency,
        status="pending",
    )
    OrderItem.objects.create(
        order=order, course=course, unit_amount_cents=course.price_cents, quantity=1
    )

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": course.currency,
                "unit_amount": course.price_cents,
                "product_data": {"name": course.title},
            },
            "quantity": 1,
        }],
        # ⬇️ redirige directement vers le lecteur du cours
        success_url=f"http://localhost:5173/player/{course.id}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url="http://localhost:5173/cancel",
        customer_email=getattr(request.user, "email", None),
        metadata={"order_id": str(order.id), "course_id": str(course.id)},
    )
    order.stripe_session_id = session.id
    order.save(update_fields=["stripe_session_id"])

    return Response({"checkout_url": session.url}, status=status.HTTP_200_OK)



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def checkout_session_status(request):
    session_id = request.query_params.get("session_id")
    if not session_id:
        return Response({"detail": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    order = (Order.objects
             .filter(stripe_session_id=session_id, user=request.user)
             .prefetch_related("items__course").first())
    if not order:
        return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)

    item = order.items.first()
    course_id = item.course_id if item else None
    return Response({"status": order.status, "course_id": course_id})