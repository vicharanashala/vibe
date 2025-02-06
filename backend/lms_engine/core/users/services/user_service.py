# users/services/user_service.py

import logging

from django.contrib.auth.models import Group

from ..models import User
from .firebase_service import FirebaseAuthService

logger = logging.getLogger(__name__)


class UserService:

    @staticmethod
    def create_user(email, password):
        """
        Create a user in Firebase.
        :param email: User email
        :param password: User password
        :return: Firebase user object
        """
        try:
            firebase_user = FirebaseAuthService.create_user(
                email=email, password=password
            )
            logger.info(f"Firebase user created successfully: {firebase_user.uid}")
            return firebase_user
        except Exception as e:
            logger.error(f"Error creating Firebase user: {e}")
            raise

    @staticmethod
    def delete_user(user: User):
        """
        Deletes a user and removes their associated Firebase record.
        :param user: User instance to delete.
        """
        if user.firebase_uid:
            try:
                FirebaseAuthService.delete_user(user.firebase_uid)
                logger.info(
                    f"Firebase user with UID {user.firebase_uid} deleted for user {user.email}."
                )
            except Exception as e:
                logger.exception(
                    f"Error while deleting Firebase user for {user.email}: {e}"
                )
        else:
            logger.info(f"User {user.email} does not have a Firebase UID.")

    @staticmethod
    def disable_user(user: User):
        """
        Disables a user in Firebase.
        :param user: User instance to disable in Firebase.
        """
        if not user.firebase_uid:
            logger.error("Firebase UID is required to disable a user.")
            raise ValueError("Firebase UID is required to disable a user.")

        try:
            FirebaseAuthService.disable_user(user.firebase_uid)
            logger.info(f"User {user.email} disabled in Firebase.")
        except Exception as e:
            logger.error(f"Failed to disable user {user.email} in Firebase: {e}")
            raise

    @staticmethod
    def enable_user(user: User):
        """
        Enable a user in Firebase.
        :param user: User instance to enable in Firebase.
        """
        if not user.firebase_uid:
            logger.error("Firebase UID is required to enable a user.")
            raise ValueError("Firebase UID is required to enable a user.")
        try:
            FirebaseAuthService.enable_user(user.firebase_uid)
            logger.info(f"User {user.email} enabled in Firebase.")
        except Exception as e:
            logger.error(f"Failed to enable user {user.email} in Firebase: {e}")
            raise
