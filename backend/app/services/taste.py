"""User taste profile vector — aggregate of visited restaurants' embeddings.

Weighted by the user's own rating (my_rating 1..5; unrated visits count as a
neutral 3). Refreshed whenever a visit is logged or deleted; recommendation
caches are invalidated via a per-user cache version bump (see app.cache).
"""

import logging
import math

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.visit import Visit

logger = logging.getLogger(__name__)

_MAX_VISITS_CONSIDERED = 50
_NEUTRAL_RATING = 3


def weighted_mean(
    vectors: list[list[float]], weights: list[float]
) -> list[float] | None:
    if not vectors or len(vectors) != len(weights):
        return None
    total_weight = sum(weights)
    if total_weight <= 0:
        return None
    dim = len(vectors[0])
    acc = [0.0] * dim
    for vec, w in zip(vectors, weights):
        for i, v in enumerate(vec):
            acc[i] += v * w
    mean = [v / total_weight for v in acc]
    norm = math.sqrt(sum(v * v for v in mean))
    if norm == 0:
        return None
    return [v / norm for v in mean]


async def refresh_taste_profile(session: AsyncSession, user: User) -> bool:
    """Recompute users.taste_profile_vector from recent visits. True if set."""
    result = await session.execute(
        select(Restaurant.embedding, Visit.my_rating)
        .join(Restaurant, Restaurant.id == Visit.restaurant_id)
        .where(Visit.user_id == user.id, Restaurant.embedding.isnot(None))
        .order_by(desc(Visit.visited_at))
        .limit(_MAX_VISITS_CONSIDERED)
    )
    rows = result.all()
    if not rows:
        user.taste_profile_vector = None
        return False

    vectors = [list(embedding) for embedding, _ in rows]
    weights = [float(rating or _NEUTRAL_RATING) for _, rating in rows]
    profile = weighted_mean(vectors, weights)
    user.taste_profile_vector = profile
    logger.info(
        "taste profile refreshed user=%s visits_used=%d set=%s",
        user.id,
        len(rows),
        profile is not None,
    )
    return profile is not None
