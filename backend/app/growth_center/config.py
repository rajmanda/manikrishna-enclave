"""Growth Center settings — deliberately separate from app.core.config.

The module reads its own environment variables so its storage can never be
pointed at the operational database by accident. There is NO fallback: when
GROWTH_CENTER_MONGO_URI is unset the module reports 503 (see db.py) instead
of borrowing the application's connection.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class GrowthCenterSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Empty string = module not configured → endpoints return 503.
    growth_center_mongo_uri: str = ""
    growth_center_db_name: str = "growth_center"

    # Firecrawl (lead discovery from the public web). Empty = the discover
    # endpoint returns 503; the rest of the CRM works without it.
    firecrawl_api_key: str = ""
    firecrawl_api_base: str = "https://api.firecrawl.dev"


@lru_cache
def get_growth_settings() -> GrowthCenterSettings:
    return GrowthCenterSettings()
