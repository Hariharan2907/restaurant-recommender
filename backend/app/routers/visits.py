import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.cache import bump_user_cache_version, get_redis
from app.db import get_session
from app.jobs import enqueue_restaurant_refresh
from app.models.user import User
from app.models.visit import Visit
from app.ratelimit import default_rate_limit
from app.schemas.visits import (
    VisitCreate,
    VisitListResponse,
    VisitOut,
    VisitRestaurant,
)
from app.services.embeddings import ensure_restaurant_embedding
from app.services.taste import refresh_taste_profile
from app.services.visits import get_or_create_restaurant, visits_page

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["visits"], dependencies=[Depends(default_rate_limit("visits"))]
)


async def _post_visit_side_effects(
    session: AsyncSession, user: User, restaurant
) -> None:
    """Embedding + taste refresh + cache invalidation. All soft-fail."""
    try:
        await ensure_restaurant_embedding(session, restaurant)
        await refresh_taste_profile(session, user)
        await session.commit()
    except Exception as exc:  # noqa: BLE001 — side effects must not fail the request
        logger.error("visit side effects failed (swallowing): %s", exc)
        await session.rollback()
    try:
        await bump_user_cache_version(get_redis(), str(user.id))
    except Exception as exc:  # noqa: BLE001
        logger.error("visit cache invalidation failed (swallowing): %s", exc)
    # Background: refresh reviews -> dishes -> embedding (30d-gated, soft-fail).
    await enqueue_restaurant_refresh(restaurant.id)


def _visit_out(visit: Visit, restaurant) -> VisitOut:
    return VisitOut(
        id=visit.id,
        restaurant=VisitRestaurant.model_validate(restaurant),
        mood=visit.mood,
        dishes_ordered=visit.dishes_ordered or [],
        my_rating=visit.my_rating,
        notes=visit.notes,
        visited_at=visit.visited_at,
    )


@router.post("/visits", response_model=VisitOut, status_code=201)
async def create_visit(
    payload: VisitCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VisitOut:
    restaurant = await get_or_create_restaurant(session, payload)
    if restaurant is None:
        raise HTTPException(
            status_code=422,
            detail="unknown restaurant: include restaurant_name, lat and lng",
        )

    visit = Visit(
        user_id=user.id,
        restaurant_id=restaurant.id,
        mood=payload.mood,
        dishes_ordered=payload.dishes_ordered,
        my_rating=payload.my_rating,
        notes=payload.notes,
    )
    if payload.visited_at is not None:
        visit.visited_at = payload.visited_at
    session.add(visit)
    await session.commit()
    await session.refresh(visit)

    await _post_visit_side_effects(session, user, restaurant)
    return _visit_out(visit, restaurant)


@router.get("/visits", response_model=VisitListResponse)
async def list_visits(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VisitListResponse:
    rows, total = await visits_page(session, user, limit, offset)
    return VisitListResponse(
        visits=[_visit_out(v, r) for v, r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete("/visits/{visit_id}", status_code=204)
async def delete_visit(
    visit_id: UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    result = await session.execute(
        select(Visit).where(Visit.id == visit_id, Visit.user_id == user.id)
    )
    visit = result.scalar_one_or_none()
    if visit is None:
        raise HTTPException(status_code=404, detail="visit_not_found")
    await session.delete(visit)
    await session.commit()

    try:
        await refresh_taste_profile(session, user)
        await session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error("taste refresh after delete failed (swallowing): %s", exc)
        await session.rollback()
    try:
        await bump_user_cache_version(get_redis(), str(user.id))
    except Exception as exc:  # noqa: BLE001
        logger.error("visit cache invalidation failed (swallowing): %s", exc)
