"""Claude Haiku batch dish extraction (PLAN.md "Dish extraction prompt").

Input: up to 50 raw reviews for one restaurant.
Output: popular_dishes rows (dish_name, mention_count, sentiment, sample_quote).
Runs in the background worker only.
"""

import json
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm import get_anthropic_client, logged_messages_create
from app.models.popular_dish import PopularDish
from app.models.restaurant import Restaurant
from app.models.review import ReviewRaw
from app.services.llm_json import strip_markdown_fences

logger = logging.getLogger(__name__)

_MAX_REVIEWS = 50
_MAX_DISHES = 12

_DISH_SYSTEM_PROMPT = """You extract popular dishes from restaurant reviews.

You receive a JSON array of reviews for ONE restaurant. Identify specific dishes
that reviewers mention (not generic words like "food", "meal", "service").

Reply with JSON only — an array of at most 12 objects:
[{"dish_name": "<canonical dish name>", "mention_count": <int>, "sentiment": <float -1..1>, "sample_quote": "<short verbatim quote mentioning the dish>"}]

Rules:
- Merge variants of the same dish ("pad thai", "Pad Thai noodles") into one entry.
- mention_count = number of distinct reviews mentioning the dish.
- sentiment reflects how positively reviewers talk about THAT dish.
- sample_quote must be copied verbatim (may be shortened with ellipsis) from a review.
- Order by mention_count descending. No prose, no markdown fences."""


async def extract_dishes(session: AsyncSession, restaurant: Restaurant) -> int:
    """Replace popular_dishes for a restaurant from its stored reviews.

    Returns the number of dishes written (0 on soft-fail)."""
    client = get_anthropic_client()
    if client is None:
        logger.warning("extract_dishes: no Anthropic client configured, skipping")
        return 0

    result = await session.execute(
        select(ReviewRaw)
        .where(ReviewRaw.restaurant_id == restaurant.id)
        .order_by(ReviewRaw.review_date.desc().nulls_last())
        .limit(_MAX_REVIEWS)
    )
    reviews = list(result.scalars())
    if not reviews:
        logger.info("extract_dishes: no reviews for restaurant=%s", restaurant.id)
        return 0

    review_payload = [
        {"text": r.text[:1000], "rating": r.rating} for r in reviews
    ]
    settings = get_settings()
    try:
        response = await logged_messages_create(
            client,
            "extract_dishes",
            model=settings.anthropic_model,
            max_tokens=2048,
            system=_DISH_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(review_payload, ensure_ascii=False),
                }
            ],
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.warning("extract_dishes: anthropic call failed: %s", exc)
        return 0

    raw = response.content[0].text if response.content else ""
    try:
        data = json.loads(strip_markdown_fences(raw))
        if not isinstance(data, list):
            raise ValueError("expected JSON array at top level")
    except Exception as exc:  # noqa: BLE001 — soft-fail on bad LLM output
        logger.warning("extract_dishes: invalid JSON (%s): %r", exc, raw[:200])
        return 0

    dishes: list[PopularDish] = []
    for item in data[:_MAX_DISHES]:
        if not isinstance(item, dict):
            continue
        name = (item.get("dish_name") or "").strip()
        if not name:
            continue
        sentiment = item.get("sentiment")
        dishes.append(
            PopularDish(
                restaurant_id=restaurant.id,
                dish_name=name[:120],
                mention_count=max(int(item.get("mention_count") or 1), 1),
                sentiment=max(min(float(sentiment), 1.0), -1.0)
                if isinstance(sentiment, (int, float))
                else None,
                sample_quote=(item.get("sample_quote") or None),
            )
        )

    await session.execute(
        delete(PopularDish).where(PopularDish.restaurant_id == restaurant.id)
    )
    session.add_all(dishes)
    logger.info(
        "extract_dishes ok restaurant=%s dishes=%d from_reviews=%d",
        restaurant.id,
        len(dishes),
        len(reviews),
    )
    return len(dishes)
