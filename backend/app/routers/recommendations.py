import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_optional_user
from app.cache import get_redis, get_user_cache_version, recs_key
from app.config import get_settings
from app.db import get_session
from app.models.user import User
from app.ratelimit import recommendations_rate_limit
from app.schemas.recommendations import (
    RecommendationResult,
    RecommendationsRequest,
    RecommendationsResponse,
)
from app.services.dishes import dishes_by_place_ids
from app.services.explain import explain_results
from app.services.filters import apply_filters
from app.services.parse import parse_query
from app.services.personalize import rank_by_taste
from app.services.places import find_places
from app.services.rank import rank_candidates
from app.services.restaurants import upsert_many
from app.services.visits import last_visits_context

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["recommendations"],
    dependencies=[Depends(recommendations_rate_limit())],
)

_RANK_POOL_SIZE = 20
_FALLBACK_RESULTS = 5


@router.post("/recommendations", response_model=RecommendationsResponse)
async def recommendations(
    req: RecommendationsRequest,
    user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
) -> RecommendationsResponse:
    """PLAN.md request flow: cache -> parse -> hard filters -> vector ranking
    by taste profile -> live Places data -> Sonnet re-rank with history.

    Anonymous users (or users with no visits yet) fall back to the
    non-personalized /search-style ranking — the cold-start path."""
    settings = get_settings()
    redis = get_redis()

    radius_m = req.radius_m or (user.default_radius_m if user else 3000)
    if user is not None:
        version = await get_user_cache_version(redis, str(user.id))
        user_part = f"u:{user.id}:v{version}"
    else:
        user_part = "anon"
    key = recs_key(user_part, req.query, req.lat, req.lng, radius_m, req.mood)

    cached = await redis.get(key)
    if cached is not None:
        data = json.loads(cached)
        data["cached"] = True
        return RecommendationsResponse(**data)

    parsed = await parse_query(req.query)
    text_query = parsed.cuisine or req.query

    try:
        candidates = await find_places(text_query, req.lat, req.lng, radius_m)
    except httpx.HTTPError as exc:
        logger.error("recommendations: places lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="places_error") from exc

    filtered = apply_filters(candidates, parsed)

    # User-level hard filters: never offer disliked cuisines.
    dislikes = [c.lower() for c in (user.cuisine_dislikes or [])] if user else []
    if dislikes:
        filtered = [
            c for c in filtered if not (c.cuisine and c.cuisine.lower() in dislikes)
        ]

    # Keep the restaurants table warm so embeddings/dishes jobs have rows.
    try:
        await upsert_many(session, filtered)
        await session.commit()
    except Exception as exc:  # noqa: BLE001 — side effect, never block
        logger.error("recommendations: upsert_many failed (swallowing): %s", exc)
        await session.rollback()

    personalized = user is not None and user.taste_profile_vector is not None
    if personalized:
        pool = await rank_by_taste(session, user, filtered, limit=_RANK_POOL_SIZE)
    else:
        pool = filtered[:_RANK_POOL_SIZE]

    dishes = await dishes_by_place_ids(session, [c.google_place_id for c in pool])
    pool_results = [
        RecommendationResult(
            **c.model_dump(), popular_dishes=dishes.get(c.google_place_id, [])
        )
        for c in pool
    ]
    # model_dump() above copies explanation=None into the new objects; the
    # Sonnet reasons (or Haiku fallback) fill them below.

    visits_ctx = await last_visits_context(session, user) if user else []
    picks = await rank_candidates(
        req.query, parsed, req.mood, pool_results, visits_ctx, dislikes
    )

    if picks:
        by_id = {r.google_place_id: r for r in pool_results}
        results = []
        for place_id, reason in picks:
            result = by_id[place_id]
            result.explanation = reason
            results.append(result)
    else:
        # Sonnet unavailable — degrade to the non-personalized explanation path.
        results = pool_results[:_FALLBACK_RESULTS]
        await explain_results(req.query, parsed, results)

    response = RecommendationsResponse(
        parsed_filters=parsed,
        results=results,
        personalized=personalized,
        cached=False,
    )
    await redis.setex(key, settings.recs_cache_ttl_s, response.model_dump_json())
    return response
