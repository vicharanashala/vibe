from core.users.permissions.base_permission import BasePermissionManager


class InstitutionPermissionManager(BasePermissionManager):
    MODEL_NAME = "institution"

    DEFAULT_MODEL_PERMISSIONS = {
        "view_institution": "Can view all institutions",
        "add_institution": "Can add institutions globally",
        "change_institution": "Can change institutions globally",
        "delete_institution": "Can delete institutions globally",
    }

    OBJECT_LEVEL_PERMISSIONS = {
        "view_institution_object": "Can view specific institution",
        "change_institution_object": "Can change specific institution",
        "delete_institution_object": "Can delete specific institution",
    }

    ROLE_PERMISSIONS = {
        "superuser": [
            "view_institution",
            "add_institution",
            "change_institution",
            "delete_institution",
        ],
        "admin": [
            "view_institution",
            "add_institution",
            "change_institution",
        ],
        "moderator": [
            "view_institution_object",
            "change_institution_object",
            "view_institution",
            "add_institution",
        ],
        "student": ["view_institution_object", "view_institution"],
    }
