import cloudinary
import cloudinary.uploader

from app.core.config import get_settings


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