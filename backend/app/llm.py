from functools import lru_cache

from anthropic import AsyncAnthropic

from app.config import get_settings


@lru_cache(maxsize=1)
def get_anthropic_client() -> AsyncAnthropic | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    return AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.anthropic_timeout_s,
    )
