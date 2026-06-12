import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.popular_dish import PopularDish
from app.models.restaurant import Restaurant
from app.ratelimit import default_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["restaurants"], dependencies=[Depends(default_rate_limit("restaurants"))]
)


class DishOut(BaseModel):
    dish_name: str
    mention_count: int
    sentiment: float | None = None
    sample_quote: str | None = None


class DishesResponse(BaseModel):
    google_place_id: str
    dishes: list[DishOut] = Field(default_factory=list)
    # Dishes are extracted from Google and Yelp reviews; Yelp requires visible
    # attribution wherever derived content is shown.
    attribution: str = "Dish data derived from Google and Yelp reviews."


@router.get("/restaurants/{place_id}/dishes", response_model=DishesResponse)
async def restaurant_dishes(
    place_id: str,
    session: AsyncSession = Depends(get_session),
) -> DishesResponse:
    result = await session.execute(
        select(PopularDish)
        .join(Restaurant, Restaurant.id == PopularDish.restaurant_id)
        .where(Restaurant.google_place_id == place_id)
        .order_by(PopularDish.mention_count.desc())
        .limit(12)
    )
    dishes = [
        DishOut(
            dish_name=d.dish_name,
            mention_count=d.mention_count,
            sentiment=d.sentiment,
            sample_quote=d.sample_quote,
        )
        for d in result.scalars()
    ]
    return DishesResponse(google_place_id=place_id, dishes=dishes)
