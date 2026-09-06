from django.core.exceptions import ValidationError

MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def validate_avatar(file):
    if file.size > MAX_AVATAR_SIZE_BYTES:
        raise ValidationError("Avatar must be 5MB or smaller.")

    content_type = getattr(file, "content_type", None)
    if content_type and content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise ValidationError("Avatar must be a JPEG, PNG, or WEBP image.")
