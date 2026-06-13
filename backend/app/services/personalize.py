"""Vector-similarity ranking against the user's taste profile (pgvector)."""

import logging
import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.search import RestaurantResult

logger = logging.getLogger(__name__)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def rank_by_taste(
    session: AsyncSession,
    user: User,
    candidates: list[RestaurantResult],
    limit: int | None = None,
) -> list[RestaurantResult]:
    """Reorder live search candidates by similarity to the user's taste vector.

    Candidates without a stored embedding keep their original relative order
    after the scored ones. Soft-fails to the input order.
    """
    profile = user.taste_profile_vector
    if profile is None or not candidates:
        return candidates[:limit] if limit else candidates

    place_ids = [c.google_place_id for c in candidates]
    try:
        result = await session.execute(
            select(Restaurant.google_place_id, Restaurant.embedding).where(
                Restaurant.google_place_id.in_(place_ids),
                Restaurant.embedding.isnot(None),
            )
        )
        embeddings = {pid: list(emb) for pid, emb in result.all()}
    except Exception as exc:  # noqa: BLE001 — personalization must not break search
        logger.error("rank_by_taste: embedding lookup failed: %s", exc)
        return candidates[:limit] if limit else candidates

    profile_list = list(profile)
    scored: list[tuple[float, int, RestaurantResult]] = []
    unscored: list[RestaurantResult] = []
    for idx, candidate in enumerate(candidates):
        embedding = embeddings.get(candidate.google_place_id)
        if embedding is None:
            unscored.append(candidate)
        else:
            scored.append(
                (cosine_similarity(profile_list, embedding), idx, candidate)
            )

    scored.sort(key=lambda item: (-item[0], item[1]))
    ordered = [c for _, _, c in scored] + unscored
    return ordered[:limit] if limit else ordered


async def discover_similar(
    session: AsyncSession,
    user: User,
    lat: float,
    lng: float,
    radius_m: int,
    limit: int = 10,
) -> tuple[list[Restaurant], bool]:
    """Nearby restaurants ranked by taste-profile similarity (Discover mode).

    Returns (restaurants, personalized). Falls back to rating order for
    cold-start users without a taste vector.
    """
    lat_deg = radius_m / 111_320
    lng_deg = radius_m / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    nearby = (
        Restaurant.lat.between(lat - lat_deg, lat + lat_deg)
        & Restaurant.lng.between(lng - lng_deg, lng + lng_deg)
    )

    dislikes = [c.lower() for c in (user.cuisine_dislikes or [])]

    if user.taste_profile_vector is not None:
        stmt = (
            select(Restaurant)
            .where(nearby, Restaurant.embedding.isnot(None))
            .order_by(
                Restaurant.embedding.cosine_distance(user.taste_profile_vector)
            )
            .limit(limit * 2)  # headroom for the dislike filter below
        )
        personalized = True
    else:
        stmt = (
            select(Restaurant)
            .where(nearby)
            .order_by(Restaurant.rating.desc().nulls_last())
            .limit(limit * 2)
        )
        personalized = False

    result = await session.execute(stmt)
    restaurants = [
        r
        for r in result.scalars()
        if not (r.cuisine and r.cuisine.lower() in dislikes)
    ][:limit]
    return restaurants, personalized
