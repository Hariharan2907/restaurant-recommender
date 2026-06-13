"""Restaurant/text embeddings.

Anthropic has no first-party embeddings API and officially recommends Voyage
AI, so vectors come from Voyage's REST endpoint (`voyage-3.5`, 1024 dims).
The schema columns are vector(1536); we zero-pad 1024 -> 1536, which leaves
cosine similarity unchanged. All entry points soft-fail to None.
"""

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.popular_dish import PopularDish
from app.models.restaurant import Restaurant

logger = logging.getLogger(__name__)


def _pad(vector: list[float], target_dim: int) -> list[float]:
    if len(vector) >= target_dim:
        return vector[:target_dim]
    return vector + [0.0] * (target_dim - len(vector))


async def embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Embed a batch of texts. Returns None (soft-fail) when unconfigured/down."""
    if not texts:
        return []
    settings = get_settings()
    if not settings.voyage_api_key:
        logger.warning("embed_texts: no Voyage API key configured, skipping")
        return None

    try:
        async with httpx.AsyncClient(timeout=settings.voyage_timeout_s) as client:
            resp = await client.post(
                settings.voyage_embeddings_url,
                headers={"Authorization": f"Bearer {settings.voyage_api_key}"},
                json={
                    "model": settings.voyage_embedding_model,
                    "input": texts,
                    "input_type": "document",
                    "output_dimension": settings.voyage_output_dim,
                },
            )
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("embed_texts: voyage call failed: %s", exc)
        return None

    try:
        data = sorted(payload["data"], key=lambda item: item["index"])
        vectors = [_pad(item["embedding"], settings.embedding_dim) for item in data]
    except (KeyError, TypeError) as exc:
        logger.warning("embed_texts: unexpected voyage response shape: %s", exc)
        return None
    if len(vectors) != len(texts):
        logger.warning(
            "embed_texts: got %d vectors for %d texts", len(vectors), len(texts)
        )
        return None
    return vectors


def restaurant_embedding_text(
    restaurant: Restaurant, dish_names: list[str] | None = None
) -> str:
    """Canonical text a restaurant is embedded from (metadata + popular dishes)."""
    parts = [restaurant.name]
    if restaurant.cuisine:
        parts.append(f"cuisine: {restaurant.cuisine}")
    if restaurant.price_tier:
        parts.append(f"price: {'$' * restaurant.price_tier}")
    if restaurant.rating is not None:
        parts.append(f"rating: {restaurant.rating:.1f}")
    if restaurant.vibe_tags:
        parts.append("vibe: " + ", ".join(restaurant.vibe_tags))
    dietary = [k for k, v in (restaurant.dietary_flags or {}).items() if v]
    if dietary:
        parts.append("dietary: " + ", ".join(dietary))
    if dish_names:
        parts.append("popular dishes: " + ", ".join(dish_names[:10]))
    return " | ".join(parts)


async def ensure_restaurant_embedding(
    session: AsyncSession, restaurant: Restaurant, *, force: bool = False
) -> bool:
    """Compute and store restaurant.embedding if missing. True when set."""
    if restaurant.embedding is not None and not force:
        return True

    result = await session.execute(
        select(PopularDish.dish_name)
        .where(PopularDish.restaurant_id == restaurant.id)
        .order_by(PopularDish.mention_count.desc())
        .limit(10)
    )
    dish_names = list(result.scalars())

    vectors = await embed_texts([restaurant_embedding_text(restaurant, dish_names)])
    if not vectors:
        return False
    restaurant.embedding = vectors[0]
    return True
