from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/restaurant_recommender"
    )
    redis_url: str = Field(default="redis://localhost:6379/0")

    anthropic_api_key: str = Field(default="")
    google_places_api_key: str = Field(default="")
    yelp_api_key: str = Field(default="")
    supabase_url: str = Field(default="")
    supabase_anon_key: str = Field(default="")

    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    cors_origins: list[str] = Field(
        default=[
            "http://localhost:8081",
            "http://localhost:19006",
        ]
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
