from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        # Include additional user information in the token
        data['role'] = user.role
        data['email'] = user.email
        data['full_name'] = f"{user.first_name} {user.last_name}"
        return data
