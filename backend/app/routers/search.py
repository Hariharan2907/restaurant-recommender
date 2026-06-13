import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_optional_user
from app.cache import get_redis, get_user_cache_version, search_key
from app.config import get_settings
from app.db import get_session
from app.models.user import User
from app.ratelimit import search_rate_limit
from app.schemas.search import SearchRequest, SearchResponse
from app.services.explain import explain_results
from app.services.filters import apply_filters
from app.services.parse import parse_query
from app.services.personalize import rank_by_taste
from app.services.places import find_places
from app.services.restaurants import upsert_many

logger = logging.getLogger(__name__)
router = APIRouter(tags=["search"])


@router.post(
    "/search",
    response_model=SearchResponse,
    dependencies=[Depends(search_rate_limit())],
)
async def search(
    req: SearchRequest,
    user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    settings = get_settings()
    redis = get_redis()

    # Results get a taste-based reorder for trained users, so their cache
    # entries must be private (and versioned for invalidation on new visits).
    personalize = user is not None and user.taste_profile_vector is not None
    key = search_key(req.query, req.lat, req.lng, req.radius_m)
    if personalize:
        version = await get_user_cache_version(redis, str(user.id))
        key = f"{key}:u{user.id}:v{version}"

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

    if personalize:
        filtered = await rank_by_taste(session, user, filtered)

    await explain_results(req.query, parsed, filtered)

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
