"""Application settings.

All values come from environment variables. On Cloud Run these are injected
from Google Secret Manager (see infra/terraform); locally use a .env file.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CommunityHub API"
    environment: str = "dev"  # dev | staging | production

    mongodb_uri: str = "mongodb://localhost:27017"
    db_name: str = "communityhub"

    # Google OAuth client ID used to verify ID tokens from the frontend.
    google_client_id: str = ""

    jwt_secret: str = "change-me-in-secret-manager-minimum-32-bytes"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24

    # DEV ONLY: enables /auth/dev-login to impersonate seeded users before a
    # Google OAuth client is configured. Must be false in staging/production.
    dev_mode: bool = True

    seed_on_start: bool = False

    # localhost:3100 = marketing site dev server; nivaasos.com origins are
    # needed for the public lead-capture endpoint (POST /api/v1/public/leads).
    cors_origins: str = (
        "http://localhost:3000,http://localhost:3100,"
        "https://community.rajmanda.com,"
        "https://nivaasos.com,https://www.nivaasos.com"
    )

    # GCS bucket for receipts/documents (empty = uploads disabled).
    gcs_bucket: str = ""

    # Shared secret for OpenClaw (WhatsApp agent) polling — stored in Secret
    # Manager, empty disables the integration (503 on poll attempts).
    openclaw_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
