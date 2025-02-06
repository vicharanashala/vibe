# core/users/utils.py
from django.contrib.auth.models import Group

ROLES = ["student", "instructor", "ta", "moderator", "admin", "superuser"]

# core/users/utils.py


def assign_role_to_user(user, role_name):
    """
    Assign a global role (group) to a user and update is_staff for specific roles.

    Args:
        user (User): The user instance.
        role_name (str): The name of the role (group) to assign.

    Raises:
        ValueError: If the specified role does not exist.

    Returns:
        bool: True if the role was successfully assigned.
    """
    try:
        group = Group.objects.get(name=role_name)
        user.groups.add(group)

        # Update is_staff for specific roles
        if role_name in ["superuser", "moderator", "admin"]:
            user.is_staff = True
            if role_name == "superuser":
                user.is_superuser = True
        else:
            user.is_staff = False  # Optional: ensure non-staff roles are not staff

        # Save the user instance
        user.save()
        return True
    except Group.DoesNotExist:
        raise ValueError(f"Role '{role_name}' does not exist.")
