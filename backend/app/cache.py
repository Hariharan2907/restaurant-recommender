import hashlib
from functools import lru_cache

import redis.asyncio as redis_asyncio

from app.config import get_settings


def quantize_coord(value: float) -> float:
    """Round to 3 decimals (~100m grid) for cache-key bucketing."""
    return round(value, 3)


def _hash(parts: list[str]) -> str:
    joined = "|".join(parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()


def search_key(query: str, lat: float, lng: float, radius_m: int) -> str:
    normalized = query.strip().lower()
    digest = _hash([
        normalized,
        f"{quantize_coord(lat)}",
        f"{quantize_coord(lng)}",
        str(radius_m),
    ])
    return f"search:{digest}"


def places_key(text_query: str, lat: float, lng: float, radius_m: int) -> str:
    normalized = text_query.strip().lower()
    digest = _hash([
        normalized,
        f"{quantize_coord(lat)}",
        f"{quantize_coord(lng)}",
        str(radius_m),
    ])
    return f"places:{digest}"


@lru_cache(maxsize=1)
def get_redis() -> redis_asyncio.Redis:
    settings = get_settings()
    return redis_asyncio.from_url(
        settings.redis_url,
        decode_responses=True,
    )
