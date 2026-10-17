"""Application settings loaded from environment variables or a local .env file."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings shared by the API and migration tooling."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "development-only-change-me-use-a-local-secret"
    database_url: str = "postgresql+psycopg://supportdesk:local-development-only@localhost:5432/supportdesk"
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    access_token_minutes: int = 60

    @field_validator("database_url", mode="before")
    @classmethod
    def add_postgres_driver(cls, value: str) -> str:
        """Use psycopg 3 when a host provides its standard PostgreSQL URL."""

        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def allowed_origins(self) -> list[str]:
        """Return the comma-separated browser origins allowed to call the API."""

        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Create settings once so the app uses one consistent configuration."""

    return Settings()
