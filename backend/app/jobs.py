"""Minimal Redis-list job queue (PLAN.md background jobs).

Producers (API request handlers) call `enqueue(...)` — fire-and-forget, soft
fail. The consumer is `python -m app.worker`. Job payloads are JSON:
    {"type": "fetch_reviews", "payload": {"restaurant_id": "..."}}

Job types:
- fetch_reviews     pull Google+Yelp reviews into reviews_raw, then chain
                    extract_dishes. Gated by a 30-day Redis marker.
- extract_dishes    Haiku batch extraction into popular_dishes, then refresh
                    the restaurant embedding (dishes feed the embedding text).
- embed_restaurant  compute restaurants.embedding if missing.
"""

import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.config import get_settings
from app.models.restaurant import Restaurant

logger = logging.getLogger(__name__)

QUEUE_KEY = "jobs:queue"

JOB_FETCH_REVIEWS = "fetch_reviews"
JOB_EXTRACT_DISHES = "extract_dishes"
JOB_EMBED_RESTAURANT = "embed_restaurant"


async def enqueue(job_type: str, payload: dict[str, Any]) -> bool:
    """Push a job; never raises (background work is always best-effort)."""
    try:
        await get_redis().lpush(
            QUEUE_KEY, json.dumps({"type": job_type, "payload": payload})
        )
        return True
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.error("enqueue %s failed (swallowing): %s", job_type, exc)
        return False


async def enqueue_restaurant_refresh(restaurant_id: UUID | str) -> None:
    """Standard post-visit hook: refresh reviews (which chains dishes+embedding),
    unless reviews were fetched within the last 30 days."""
    redis = get_redis()
    from app.services.reviews import reviews_fetched_marker

    try:
        already = await redis.get(reviews_fetched_marker(str(restaurant_id)))
    except Exception as exc:  # noqa: BLE001
        logger.error("enqueue_restaurant_refresh marker check failed: %s", exc)
        already = None
    if already:
        return
    await enqueue(JOB_FETCH_REVIEWS, {"restaurant_id": str(restaurant_id)})


async def _load_restaurant(
    session: AsyncSession, restaurant_id: str
) -> Restaurant | None:
    result = await session.execute(
        select(Restaurant).where(Restaurant.id == UUID(restaurant_id))
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is None:
        logger.warning("job: restaurant %s not found", restaurant_id)
    return restaurant


async def handle_fetch_reviews(session: AsyncSession, payload: dict) -> None:
    from app.services.reviews import (
        fetch_google_reviews,
        fetch_yelp_reviews,
        reviews_fetched_marker,
        store_reviews,
    )

    restaurant = await _load_restaurant(session, payload["restaurant_id"])
    if restaurant is None:
        return

    reviews = await fetch_google_reviews(restaurant.google_place_id)
    reviews += await fetch_yelp_reviews(restaurant.name, restaurant.lat, restaurant.lng)
    stored = await store_reviews(session, restaurant, reviews)
    await session.commit()
    logger.info(
        "fetch_reviews done restaurant=%s stored=%d", restaurant.id, stored
    )

    settings = get_settings()
    try:
        await get_redis().setex(
            reviews_fetched_marker(str(restaurant.id)),
            settings.reviews_refetch_ttl_s,
            "1",
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("fetch_reviews marker set failed: %s", exc)

    if stored:
        await enqueue(
            JOB_EXTRACT_DISHES, {"restaurant_id": str(restaurant.id)}
        )


async def handle_extract_dishes(session: AsyncSession, payload: dict) -> None:
    from app.services.dish_extraction import extract_dishes
    from app.services.embeddings import ensure_restaurant_embedding

    restaurant = await _load_restaurant(session, payload["restaurant_id"])
    if restaurant is None:
        return

    written = await extract_dishes(session, restaurant)
    if written:
        # dishes are part of the embedding text — recompute
        await ensure_restaurant_embedding(session, restaurant, force=True)
    await session.commit()


async def handle_embed_restaurant(session: AsyncSession, payload: dict) -> None:
    from app.services.embeddings import ensure_restaurant_embedding

    restaurant = await _load_restaurant(session, payload["restaurant_id"])
    if restaurant is None:
        return
    await ensure_restaurant_embedding(session, restaurant)
    await session.commit()


HANDLERS = {
    JOB_FETCH_REVIEWS: handle_fetch_reviews,
    JOB_EXTRACT_DISHES: handle_extract_dishes,
    JOB_EMBED_RESTAURANT: handle_embed_restaurant,
}


async def run_job(session: AsyncSession, raw: str) -> bool:
    """Decode and dispatch one queued job. True when handled successfully."""
    try:
        job = json.loads(raw)
        handler = HANDLERS[job["type"]]
        payload = job["payload"]
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        logger.error("run_job: malformed job %r: %s", raw[:200], exc)
        return False

    try:
        await handler(session, payload)
        return True
    except Exception as exc:  # noqa: BLE001 — one bad job must not kill the worker
        logger.exception("run_job: %s failed: %s", job["type"], exc)
        await session.rollback()
        return False
