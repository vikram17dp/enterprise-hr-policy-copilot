from fastapi import APIRouter, Depends, UploadFile, File

from app.core.dependencies import get_current_user


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    return {
        "filename": file.filename,
        "message": "Document upload received",
    }