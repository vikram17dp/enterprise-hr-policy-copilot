import io
import logging

import cloudinary
import cloudinary.uploader

from app.core.config import get_settings


logger = logging.getLogger(__name__)

settings = get_settings()


cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def upload_document(file_path: str):
    result = cloudinary.uploader.upload(
        file_path,
        resource_type="auto",
        folder="hr-policy-documents",
    )

    return {
        "public_id": result["public_id"],
        "secure_url": result["secure_url"],
        "resource_type": result["resource_type"],
        "format": result.get("format"),
    }


def upload_avatar(file_bytes: bytes):
    """Upload a user's profile picture to Cloudinary and return its metadata.

    Only the returned `secure_url` / `public_id` are persisted (in the `users`
    table). Uses the server-side Cloudinary credentials — the API secret is
    never sent to the browser.
    """
    result = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        resource_type="image",
        folder="profile-avatars",
    )

    return {
        "public_id": result["public_id"],
        "secure_url": result["secure_url"],
        "format": result.get("format"),
        "width": result.get("width"),
        "height": result.get("height"),
    }


def delete_by_public_id(public_id: str | None) -> None:
    """Delete a previously uploaded avatar (best-effort, server-side only).

    Called AFTER a new avatar has been uploaded and persisted, so a failed
    cleanup never leaves the user without a profile picture.
    """
    if not public_id:
        return
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception:  # noqa: BLE001 - cleanup must not break the upload flow
        logger.warning(
            "Could not delete old Cloudinary avatar (public_id present); "
            "continuing."
        )