from rest_framework import generics, permissions
from .models import Enrollment
from .serializers import MyLibraryItemSerializer

class MyLibraryView(generics.ListAPIView):
    serializer_class = MyLibraryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user).select_related("course")