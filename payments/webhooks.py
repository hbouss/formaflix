# payments/webhooks.py
import os, stripe
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from orders.models import Order
from learning.models import Enrollment
from catalog.models import Course

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        return HttpResponse(status=400)

    if event.get("type") == "checkout.session.completed":
        data = event["data"]["object"]
        session_id = data.get("id")
        order = Order.objects.filter(stripe_session_id=session_id).first()
        if order and order.status != "paid":
            order.status = "paid"
            order.save(update_fields=["status"])
            course_id = (data.get("metadata") or {}).get("course_id")
            if course_id:
                try:
                    course = Course.objects.get(id=course_id)
                    Enrollment.objects.get_or_create(user=order.user, course=course)
                except Course.DoesNotExist:
                    pass

    return HttpResponse(status=200)