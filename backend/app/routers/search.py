import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis, search_key
from app.config import get_settings
from app.db import get_session
from app.schemas.search import SearchRequest, SearchResponse
from app.services.filters import apply_filters
from app.services.parse import parse_query
from app.services.places import find_places
from app.services.restaurants import upsert_many

logger = logging.getLogger(__name__)
router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(
    req: SearchRequest,
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    settings = get_settings()
    redis = get_redis()
    key = search_key(req.query, req.lat, req.lng, req.radius_m)

    cached = await redis.get(key)
    if cached is not None:
        data = json.loads(cached)
        data["cached"] = True
        return SearchResponse(**data)

    parsed = await parse_query(req.query)
    text_query = parsed.cuisine or req.query

    try:
        candidates = await find_places(text_query, req.lat, req.lng, req.radius_m)
    except httpx.HTTPError as exc:
        logger.error("search: places lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="places_error") from exc

    filtered = apply_filters(candidates, parsed)

    try:
        await upsert_many(session, filtered)
        await session.commit()
    except Exception as exc:  # noqa: BLE001 — never block user on side-effect
        logger.error("search: upsert_many failed (swallowing): %s", exc)
        await session.rollback()

    response = SearchResponse(parsed_filters=parsed, results=filtered, cached=False)
    await redis.setex(
        key,
        settings.search_cache_ttl_s,
        response.model_dump_json(),
    )
    return response
