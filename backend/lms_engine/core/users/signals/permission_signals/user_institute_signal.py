import logging

from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from core.users.models import User, UserInstitution
from core.users.permissions.user_institute_permission import (
    InstitutionPermissionManager,
)

# Get a logger instance for this module
logger = logging.getLogger(__name__)


@receiver(post_save, sender=UserInstitution)
def assign_permissions_on_save(sender, instance, created, **kwargs):
    """
    Assign object-level permissions when a UserInstitution instance is created or updated.

    :param sender: Model class
    :param instance: UserInstitution instance
    :param created: Boolean indicating if the instance was created
    """
    roles = instance.user.groups.values_list("name", flat=True)  # Get all role names
    if created:
        logger.info(
            f"[Signal: post_save] UserInstitution created. Assigning permissions for user '{instance.user.email}' "
            f"and institution '{instance.institution.name}' [Roles: {list(roles)}]."
        )
    else:
        logger.info(
            f"[Signal: post_save] UserInstitution updated. Reassigning permissions for user '{instance.user.email}' "
            f"and institution '{instance.institution.name}' [Roles: {list(roles)}]."
        )

    # Assign permissions
    InstitutionPermissionManager.assign_permissions(
        instance.user, instance.institution, roles
    )

    logger.info(
        f"[Signal: post_save] Completed assigning permissions for user '{instance.user.email}' "
        f"and institution '{instance.institution.name}'."
    )


@receiver(post_delete, sender=UserInstitution)
def remove_permissions_on_delete(sender, instance, **kwargs):
    """
    Remove object-level permissions when a UserInstitution instance is deleted.

    :param sender: Model class
    :param instance: UserInstitution instance
    """
    roles = instance.user.groups.values_list("name", flat=True)

    logger.info(
        f"[Signal: post_delete] Removing permissions for user '{instance.user.email}' "
        f"and institution '{instance.institution.name}' [Roles: {list(roles)}]."
    )

    # Remove permissions
    InstitutionPermissionManager.remove_permissions(
        instance.user, instance.institution, roles
    )

    logger.info(
        f"[Signal: post_delete] Completed removing permissions for user '{instance.user.email}' "
        f"and institution '{instance.institution.name}'."
    )


@receiver(m2m_changed, sender=User.groups.through)
def update_permissions_on_group_change(sender, instance, action, pk_set, **kwargs):
    """
    Update permissions when a user's group membership changes.

    :param sender: The intermediate model for the m2m relation.
    :param instance: The user instance whose group membership changed.
    :param action: The type of change (e.g., 'post_add', 'post_remove', 'post_clear').
    :param pk_set: The primary keys of the groups being added or removed.
    """
    from django.contrib.auth.models import Group  # Import Group for querying

    if action == "post_add":
        # Roles being added
        new_roles = Group.objects.filter(pk__in=pk_set).values_list("name", flat=True)
        logger.info(
            f"user_institute_signal [Group Change: post_add] Adding permissions for user '{instance.email}' [New Roles: {list(new_roles)}]."
        )

        # Assign permissions for all institutions related to the user
        for user_institution in instance.user_institution_links.all():
            InstitutionPermissionManager.assign_permissions(
                instance, user_institution.institution, new_roles
            )

    elif action == "post_remove":
        # Roles being removed
        removed_roles = Group.objects.filter(pk__in=pk_set).values_list(
            "name", flat=True
        )
        remaining_roles = instance.groups.values_list("name", flat=True)

        logger.info(
            f"user_institute_signal [Group Change: post_remove] Removing permissions for user '{instance.email}' [Removed Roles: {list(removed_roles)}]. Remaining Roles: {list(remaining_roles)}."
        )

        # Remove only permissions specific to the removed roles
        for user_institution in instance.user_institution_links.all():
            InstitutionPermissionManager.remove_permissions(
                instance, user_institution.institution, removed_roles
            )

    elif action == "post_clear":
        # All roles are being removed
        logger.info(
            f"user_institute_signal [Group Change: post_clear] Clearing all permissions for user '{instance.email}'."
        )
        all_roles = InstitutionPermissionManager.ROLE_PERMISSIONS.keys()

        # Remove permissions for all institutions related to the user
        for user_institution in instance.user_institution_links.all():
            InstitutionPermissionManager.remove_permissions(
                instance, user_institution.institution, all_roles
            )
