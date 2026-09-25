from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.conversations import router as conversations_router
from app.api.v1.endpoints.documents import router as documents_router
from app.api.v1.endpoints.saved_answers import router as saved_answers_router
from app.api.v1.endpoints.feedback import router as feedback_router


router = APIRouter(
    prefix="/api/v1"
)

router.include_router(auth_router)
router.include_router(users_router)
router.include_router(chat_router)
router.include_router(conversations_router)
router.include_router(documents_router)
router.include_router(saved_answers_router)
router.include_router(feedback_router)
