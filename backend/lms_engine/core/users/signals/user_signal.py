# users/signals/user_signal.py

import logging

from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save
from django.dispatch import receiver

from ..models import User, UserInstitution
from ..services.user_service import UserService

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=User)
def handle_user_deletion(sender, instance, **kwargs):
    """
    Handles user deletion by delegating to the UserService.
    """
    if instance.pk:
        logger.debug(f"Preparing to delete user {instance.email}.")
        try:
            UserService.delete_user(instance)
            logger.info(f"User {instance.email} deletion handled successfully.")
        except Exception as e:
            logger.exception(f"Error handling user deletion for {instance.email}: {e}")


# @receiver(pre_save, sender=User)
# def handle_user_creation(sender, instance:User, **kwargs):
#     """
#     Pre-save signal to handle Firebase user creation.
#     If the user does not already have a Firebase UID, create one.
#     """
#     print("Handling user creation")
#     if not instance.pk:  # New user being created
#         try:
#             print("Creating user in Firebase")
#             firebase_user = UserService.create_user(instance.email, instance.password)
#             instance.firebase_uid = firebase_user.uid  # Attach Firebase UID to the instance
#         except Exception as e:
#             raise ValueError(f"Failed to create user in Firebase: {str(e)}")
#
@receiver(pre_save, sender=User)
def handle_user_disable(sender, instance, **kwargs):
    """
    Pre-save signal to disable a user in Firebase when `is_active` changes to False.
    """
    if instance.pk:  # Ensure this is not a new user
        try:
            existing_user = User.objects.get(pk=instance.pk)
            # Check if `is_active` has changed to False
            if not instance.is_active and existing_user.is_active:
                UserService.disable_user(instance)
        except User.DoesNotExist:
            # Handle the case where the user doesn't exist in the database
            logger.warning(
                f"User {instance.email} does not exist for disable handling."
            )


@receiver(pre_save, sender=User)
def handle_user_enable(sender, instance, **kwargs):
    """
    Pre-save signal to enable a user in Firebase when `is_active` changes to True.
    """
    if instance.pk:  # Ensure this is not a new user
        try:
            existing_user = User.objects.get(pk=instance.pk)
            # Check if `is_active` has changed to True
            if instance.is_active and not existing_user.is_active:
                UserService.enable_user(
                    instance
                )  # Implement enable_user in UserService
        except User.DoesNotExist:
            logger.warning(f"User {instance.email} does not exist for enable handling.")
