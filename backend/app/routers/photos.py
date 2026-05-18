import logging
import re

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.cache import get_redis
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["photos"])

_PHOTO_NAME_RE = re.compile(r"^places/[A-Za-z0-9_\-]+/photos/[A-Za-z0-9_\-]+$")
_PHOTO_CACHE_TTL_S = 3600  # 1h — Google photoUri tokens last longer but this is conservative


def _photo_cache_key(name: str, w: int) -> str:
    return f"photo:{w}:{name}"


@router.get("/photo")
async def photo(
    name: str = Query(..., description="Google Places photo resource name"),
    w: int = Query(default=800, ge=64, le=4800, description="Max width in pixels"),
) -> RedirectResponse:
    if not _PHOTO_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="invalid photo name")

    settings = get_settings()
    if not settings.google_places_api_key:
        raise HTTPException(status_code=503, detail="photos unavailable")

    redis = get_redis()
    cache_key = _photo_cache_key(name, w)
    cached_uri = await redis.get(cache_key)
    if cached_uri is not None:
        return RedirectResponse(url=cached_uri, status_code=307)

    url = f"https://places.googleapis.com/v1/{name}/media"
    params = {"maxWidthPx": str(w), "skipHttpRedirect": "true"}
    headers = {"X-Goog-Api-Key": settings.google_places_api_key}

    try:
        async with httpx.AsyncClient(timeout=settings.google_places_timeout_s) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("photo resolve failed name=%s err=%s", name, exc)
        raise HTTPException(status_code=502, detail="photo upstream error") from exc

    photo_uri = data.get("photoUri")
    if not photo_uri:
        raise HTTPException(status_code=502, detail="photo response missing photoUri")

    await redis.setex(cache_key, _PHOTO_CACHE_TTL_S, photo_uri)
    return RedirectResponse(url=photo_uri, status_code=307)
