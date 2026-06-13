import logging
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.visit import Visit
from app.schemas.visits import VisitCreate

logger = logging.getLogger(__name__)


async def get_or_create_restaurant(
    session: AsyncSession, payload: VisitCreate
) -> Restaurant | None:
    """Resolve the visited restaurant, creating it from the payload's metadata
    when /search never upserted it. None when unknown and metadata is missing."""
    result = await session.execute(
        select(Restaurant).where(
            Restaurant.google_place_id == payload.google_place_id
        )
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is not None:
        return restaurant

    if not (
        payload.restaurant_name
        and payload.lat is not None
        and payload.lng is not None
    ):
        return None

    restaurant = Restaurant(
        google_place_id=payload.google_place_id,
        name=payload.restaurant_name,
        cuisine=payload.cuisine,
        lat=payload.lat,
        lng=payload.lng,
    )
    session.add(restaurant)
    await session.flush()
    return restaurant


async def visits_page(
    session: AsyncSession, user: User, limit: int, offset: int
) -> tuple[list[tuple[Visit, Restaurant]], int]:
    total = (
        await session.execute(
            select(func.count()).select_from(Visit).where(Visit.user_id == user.id)
        )
    ).scalar_one()

    result = await session.execute(
        select(Visit, Restaurant)
        .join(Restaurant, Restaurant.id == Visit.restaurant_id)
        .where(Visit.user_id == user.id)
        .order_by(desc(Visit.visited_at), desc(Visit.id))
        .limit(limit)
        .offset(offset)
    )
    return list(result.all()), int(total)


async def last_visits_context(
    session: AsyncSession, user: User, limit: int = 20
) -> list[dict]:
    """Compact visit history for the Sonnet rank prompt."""
    result = await session.execute(
        select(Visit, Restaurant)
        .join(Restaurant, Restaurant.id == Visit.restaurant_id)
        .where(Visit.user_id == user.id)
        .order_by(desc(Visit.visited_at))
        .limit(limit)
    )
    context = []
    for visit, restaurant in result.all():
        context.append(
            {
                "restaurant": restaurant.name,
                "cuisine": restaurant.cuisine,
                "my_rating": visit.my_rating,
                "mood": visit.mood,
                "dishes_ordered": visit.dishes_ordered,
                "visited_at": visit.visited_at.date().isoformat()
                if visit.visited_at
                else None,
            }
        )
    return context
