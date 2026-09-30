from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_router
from app.services.redis_service import RedisService


app = FastAPI(
    title="Enterprise HR Policy Agentic RAG Copilot",
    version="1.0.0",
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API routes
app.include_router(api_router)


@app.get("/")
def root():
    return {
        "message": "Enterprise HR Policy Copilot API is running"
    }


@app.get("/health")
def health():
    # Redis is an OPTIONAL cache: report its status but never mark the app
    # unhealthy just because Redis is down.
    return {
        "status": "healthy",
        "api": "ok",
        "redis": "ok" if RedisService.ping() else "unavailable",
    }