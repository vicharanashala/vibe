from decouple import config
from firebase_admin import auth, credentials, initialize_app
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from core.users.models import User


class FirebaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION")

        if not auth_header:
            return None

        try:
            id_token = auth_header.split(" ")[1]  # Extract token from Bearer
            decoded_token = auth.verify_id_token(id_token)
            firebase_uid = decoded_token["uid"]

            # Get or create user in the database
            user, created = User.objects.get_or_create(
                firebase_uid=firebase_uid,
                defaults={"email": decoded_token["email"]},
            )
            return (user, None)
        except Exception as e:
            raise AuthenticationFailed(f"Invalid Firebase ID token: {str(e)}")


cred_path = config("FIREBASE_ADMIN_SDK_CREDENTIALS_PATH")
if not cred_path:
    raise Exception("Firebase Admin SDK credentials not configured.")

cred = credentials.Certificate(cred_path)
firebase_app = initialize_app(cred)


def test_firebase():
    try:
        user = auth.get_user_by_email("testuser@example.com")

        print(f"User: {user.uid}")
    except Exception as e:
        print(f"Error: {str(e)}")
