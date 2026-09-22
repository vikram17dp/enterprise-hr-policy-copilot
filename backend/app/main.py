from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_router


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
    return {
        "status": "healthy"
    }