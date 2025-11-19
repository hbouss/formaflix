from rest_framework import serializers
from .models import User

class RegisterSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(max_length=150)
    last_name  = serializers.CharField(max_length=150)
    password   = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model  = User
        fields = ["username", "email", "first_name", "last_name", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            username   = validated_data["username"],
            email      = validated_data.get("email", ""),
            password   = validated_data["password"],
            first_name = validated_data.get("first_name", "").strip(),
            last_name  = validated_data.get("last_name", "").strip(),
        )