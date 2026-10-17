"""FastAPI application entry point and health checks."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import engine
from app.routes import auth, dashboard, tickets, users

settings = get_settings()
production = settings.app_env.lower() == "production"
if production and (
    len(settings.secret_key) < 32
    or "replace-this" in settings.secret_key.lower()
    or "development-only" in settings.secret_key.lower()
):
    raise RuntimeError("Set SECRET_KEY to a unique random value of at least 32 characters")
if production and any(
    placeholder in settings.database_url.lower()
    for placeholder in ("replace-this", "local-development-only")
):
    raise RuntimeError("Set DATABASE_URL to your hosted PostgreSQL connection string")
if production and not settings.allowed_origins:
    raise RuntimeError("Set CORS_ORIGINS to the public frontend URL before deployment")

app = FastAPI(
    title="SupportDesk API",
    version="1.0.0",
    docs_url=None if production else "/docs",
    redoc_url=None if production else "/redoc",
    openapi_url=None if production else "/openapi.json",
)

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Liveness check: the API process is responding."""

    return {"status": "ok"}


@app.get("/ready", tags=["health"])
def readiness_check() -> dict[str, str]:
    """Readiness check: the API can reach PostgreSQL."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database is not ready") from error
    return {"status": "ready"}
