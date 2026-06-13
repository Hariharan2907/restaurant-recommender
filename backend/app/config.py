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

    anthropic_model: str = Field(default="claude-haiku-4-5-20251001")
    # Sonnet for the /recommendations re-rank (PLAN.md "Rank call").
    anthropic_rank_model: str = Field(default="claude-sonnet-4-6")
    anthropic_rank_timeout_s: float = Field(default=10.0)

    # Embeddings: Anthropic has no first-party embeddings API and officially
    # recommends Voyage AI. voyage-3.5 returns 1024-dim vectors which we
    # zero-pad to the schema's vector(1536) — cosine distance is invariant
    # to zero padding, so similarity ranking is unaffected.
    voyage_api_key: str = Field(default="")
    voyage_embeddings_url: str = Field(default="https://api.voyageai.com/v1/embeddings")
    voyage_embedding_model: str = Field(default="voyage-3.5")
    voyage_output_dim: int = Field(default=1024)
    voyage_timeout_s: float = Field(default=10.0)
    embedding_dim: int = Field(default=1536)  # column width in the schema
    google_places_url: str = Field(
        default="https://places.googleapis.com/v1/places:searchText"
    )
    anthropic_timeout_s: float = Field(default=3.0)
    # Explanations cover ~20 results in one call — needs more than the
    # parse-call timeout or it soft-fails and results ship unexplained.
    anthropic_explain_timeout_s: float = Field(default=20.0)
    google_places_timeout_s: float = Field(default=5.0)
    search_cache_ttl_s: int = Field(default=600)        # 10 min
    places_cache_ttl_s: int = Field(default=604800)     # 7 days
    recs_cache_ttl_s: int = Field(default=600)          # 10 min (PLAN.md)
    reviews_refetch_ttl_s: int = Field(default=2592000)  # 30 days (PLAN.md)

    yelp_api_url: str = Field(default="https://api.yelp.com/v3")
    yelp_timeout_s: float = Field(default=5.0)

    supabase_url: str = Field(default="")
    supabase_anon_key: str = Field(default="")
    # HS256 verification (legacy Supabase JWT secret). If set, takes precedence
    # over JWKS-based verification.
    supabase_jwt_secret: str = Field(default="")
    # Override the JWKS URL; defaults to {supabase_url}/auth/v1/.well-known/jwks.json
    supabase_jwks_url: str = Field(default="")
    supabase_jwt_aud: str = Field(default="authenticated")

    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")
    # Error tracking — Sentry initializes only when a DSN is provided.
    sentry_dsn: str = Field(default="")

    rate_limit_enabled: bool = Field(default=True)
    # /search and /recommendations call Anthropic + Google per cache miss, so
    # their limits are deliberately tight to cap spend.
    rate_limit_search_user_per_min: int = Field(default=10)
    rate_limit_search_ip_per_min: int = Field(default=30)
    rate_limit_recs_user_per_min: int = Field(default=6)
    rate_limit_recs_ip_per_min: int = Field(default=20)
    rate_limit_default_user_per_min: int = Field(default=60)
    rate_limit_default_ip_per_min: int = Field(default=120)

    max_request_bytes: int = Field(default=65536)  # 64 KiB

    cors_origins: list[str] = Field(
        default=[
            "http://localhost:8081",
            "http://localhost:19006",
        ]
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
