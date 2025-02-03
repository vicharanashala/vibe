from ..users.models import User
from .constants import DEFAULT_MAX_LEN


def truncate_text(text, max_length=DEFAULT_MAX_LEN, truncate='...'):
    if len(text) > max_length:
        return text[:max_length - len(truncate)] + truncate
    return text

def get_user(obj):
    if not isinstance(obj, User):
        raise ValueError('Object is not a User instance')
    
    return obj
