# users/services/firebase_service.py

import logging
from firebase_admin import auth as firebase_auth

# Get a logger instance for this module
logger = logging.getLogger(__name__)


class FirebaseAuthService:
    @staticmethod
    def delete_user(firebase_uid):
        """
        Deletes a user from Firebase.
        :param firebase_uid: The Firebase UID of the user to delete.
        """
        if not firebase_uid:
            logger.error("Firebase UID is required for user deletion.")
            raise ValueError("Firebase UID is required for user deletion.")

        try:
            firebase_auth.delete_user(firebase_uid)
            logger.info(f"Firebase user with UID {firebase_uid} deleted successfully.")
        except firebase_auth.UserNotFoundError:
            logger.warning(f"Firebase user with UID {firebase_uid} not found.")
        except Exception as e:
            logger.exception(f"Unexpected error while deleting Firebase user with UID {firebase_uid}: {e}")

    @staticmethod
    def create_user(email, password):
        """
        Creates a user in Firebase.
        :param email: Email address for the user.
        :param password: Password for the user.
        :return: Firebase UserRecord object.
        """
        try:
            firebase_user = firebase_auth.create_user(email=email, password=password)
            logger.info(f"Firebase user created with UID {firebase_user.uid}")
            return firebase_user
        except Exception as e:
            logger.exception(f"Error creating Firebase user for {email}: {e}")
            raise

    @staticmethod
    def disable_user(firebase_uid):
        """
        Disables a user in Firebase.
        :param firebase_uid: The Firebase UID of the user to disable.
        """
        if not firebase_uid:
            logger.error("Firebase UID is required to disable a user.")
            raise ValueError("Firebase UID is required to disable a user.")

        try:
            firebase_auth.update_user(firebase_uid, disabled=True)
            logger.info(f"Firebase user with UID {firebase_uid} disabled successfully.")
        except firebase_auth.UserNotFoundError:
            logger.warning(f"Firebase user with UID {firebase_uid} not found.")
        except Exception as e:
            logger.exception(f"Unexpected error while disabling Firebase user with UID {firebase_uid}: {e}")
            raise

    @staticmethod
    def enable_user(firebase_uid):
        """
        Enables a user in Firebase.
        :param firebase_uid: The Firebase UID of the user to enable.
        """
        if not firebase_uid:
            logger.error("Firebase UID is required to enable a user.")
            raise ValueError("Firebase UID is required to enable a user.")

        try:
            firebase_auth.update_user(firebase_uid, disabled=False)
            logger.info(f"Firebase user with UID {firebase_uid} enabled successfully.")
        except firebase_auth.UserNotFoundError:
            logger.warning(f"Firebase user with UID {firebase_uid} not found.")
        except Exception as e:
            logger.exception(f"Unexpected error while enabling Firebase user with UID {firebase_uid}: {e}")
            raise