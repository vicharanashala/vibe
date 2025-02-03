from rest_framework.fields import EmailField, CharField
from rest_framework.serializers import Serializer


class SignupSerializer(Serializer):
    email = EmailField(help_text="User's email address", required=True)
    password = CharField(help_text="User's password", required=True)
    first_name = CharField(help_text="User's first name", required=True)
    last_name = CharField(help_text="User's last name", required=True)

