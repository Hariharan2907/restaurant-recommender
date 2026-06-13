import json
import logging

import httpx

from app.cache import get_redis, places_key
from app.config import get_settings
from app.schemas.search import RestaurantResult

logger = logging.getLogger(__name__)

_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.photos",
])

_MAX_PHOTOS = 5

_PRICE_LEVEL_MAP = {
    "PRICE_LEVEL_FREE": 1,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


def _parse_place(raw: dict, cuisine_hint: str | None) -> RestaurantResult | None:
    place_id = raw.get("id")
    name = (raw.get("displayName") or {}).get("text")
    loc = raw.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")
    if not (place_id and name and lat is not None and lng is not None):
        return None
    photo_refs = [p["name"] for p in (raw.get("photos") or [])[:_MAX_PHOTOS] if p.get("name")]
    return RestaurantResult(
        google_place_id=place_id,
        name=name,
        cuisine=cuisine_hint,
        rating=raw.get("rating"),
        user_ratings_total=raw.get("userRatingCount"),
        price_tier=_PRICE_LEVEL_MAP.get(raw.get("priceLevel", "")),
        lat=lat,
        lng=lng,
        address=raw.get("formattedAddress"),
        photo_refs=photo_refs,
    )


async def find_places(
    text_query: str,
    lat: float,
    lng: float,
    radius_m: int,
) -> list[RestaurantResult]:
    settings = get_settings()
    redis = get_redis()
    key = places_key(text_query, lat, lng, radius_m)

    cached = await redis.get(key)
    if cached is not None:
        logger.info("find_places cache HIT key=%s", key)
        data = json.loads(cached)
        return [RestaurantResult(**item) for item in data]

    if not settings.google_places_api_key:
        logger.warning("find_places: no Google Places API key configured")
        return []

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": _FIELD_MASK,
    }
    body = {
        "textQuery": text_query,
        # Pin results to restaurants. Without this, a bare cuisine term like "indian"
        # matches the COUNTRY "India" (locationBias is only a soft hint, so a strong
        # textual match to geography outranks nearby eateries). This restriction also
        # covers every other cuisine that collides with a place name (italian→Italy, etc.).
        "includedType": "restaurant",
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius_m),
            }
        },
    }

    async with httpx.AsyncClient(timeout=settings.google_places_timeout_s) as client:
        resp = await client.post(settings.google_places_url, headers=headers, json=body)
        resp.raise_for_status()
        payload = resp.json()

    parsed: list[RestaurantResult] = []
    for raw in payload.get("places", []):
        result = _parse_place(raw, cuisine_hint=text_query)
        if result is not None:
            parsed.append(result)

    await redis.setex(
        key,
        settings.places_cache_ttl_s,
        json.dumps([r.model_dump() for r in parsed]),
    )
    logger.info("find_places cache MISS key=%s count=%d", key, len(parsed))
    return parsed
