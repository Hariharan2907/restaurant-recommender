import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_session
from app.models.user import User
from app.ratelimit import default_rate_limit
from app.schemas.search import RestaurantResult
from app.services.dishes import dishes_by_place_ids
from app.services.personalize import discover_similar

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["discover"], dependencies=[Depends(default_rate_limit("discover"))]
)


class DiscoverResult(RestaurantResult):
    popular_dishes: list[str] = Field(default_factory=list)


class DiscoverResponse(BaseModel):
    results: list[DiscoverResult]
    personalized: bool


@router.get("/discover", response_model=DiscoverResponse)
async def discover(
    lat: float = Query(ge=-90.0, le=90.0),
    lng: float = Query(ge=-180.0, le=180.0),
    radius_m: int | None = Query(default=None, ge=100, le=20000),
    limit: int = Query(default=10, ge=1, le=25),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DiscoverResponse:
    """Similar-restaurant discovery: nearby places already in our DB, ranked by
    pgvector similarity to the user's taste profile (rating order as the
    cold-start fallback)."""
    effective_radius = radius_m or user.default_radius_m
    restaurants, personalized = await discover_similar(
        session, user, lat, lng, effective_radius, limit
    )
    dishes = await dishes_by_place_ids(
        session, [r.google_place_id for r in restaurants]
    )
    results = [
        DiscoverResult(
            google_place_id=r.google_place_id,
            name=r.name,
            cuisine=r.cuisine,
            rating=r.rating,
            price_tier=r.price_tier,
            lat=r.lat,
            lng=r.lng,
            popular_dishes=dishes.get(r.google_place_id, []),
        )
        for r in restaurants
    ]
    return DiscoverResponse(results=results, personalized=personalized)
