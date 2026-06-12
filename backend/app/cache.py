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


def recs_key(
    user_part: str,
    query: str,
    lat: float,
    lng: float,
    radius_m: int,
    mood: str | None,
) -> str:
    normalized = query.strip().lower()
    digest = _hash([
        user_part,
        normalized,
        f"{quantize_coord(lat)}",
        f"{quantize_coord(lng)}",
        str(radius_m),
        (mood or "").strip().lower(),
    ])
    return f"recs:{digest}"


def _user_version_key(user_id: str) -> str:
    return f"recsver:{user_id}"


async def get_user_cache_version(redis: "redis_asyncio.Redis", user_id: str) -> str:
    """Per-user cache generation. Bumped on new visits so stale personalized
    responses die without scanning for their keys."""
    version = await redis.get(_user_version_key(user_id))
    return version or "0"


async def bump_user_cache_version(redis: "redis_asyncio.Redis", user_id: str) -> None:
    await redis.incr(_user_version_key(user_id))


@lru_cache(maxsize=1)
def get_redis() -> redis_asyncio.Redis:
    settings = get_settings()
    return redis_asyncio.from_url(
        settings.redis_url,
        decode_responses=True,
    )
