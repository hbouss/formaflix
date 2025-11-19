# accounts/auth.py
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Accepte { email, password } côté client.
    On retrouve l'utilisateur par email et on injecte son username
    dans le flux standard de SimpleJWT (qui authentifie via username).
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # On expose 'email' au lieu du champ username
        self.fields['email'] = serializers.EmailField()
        self.fields.pop(self.username_field, None)  # supprime 'username' du schema

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise serializers.ValidationError({"detail": "email and password required"})

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # même message que SimpleJWT pour rester neutre
            raise serializers.ValidationError({"detail": "No active account found with the given credentials"})

        # On replie sur le flux standard en posant le username attendu
        attrs[self.username_field] = getattr(user, self.username_field)
        attrs['password'] = password
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Claims utiles côté front
        token['username']   = user.get_username()
        token['email']      = user.email
        token['first_name'] = user.first_name
        token['last_name']  = user.last_name
        return token


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer