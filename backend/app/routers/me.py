import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_session
from app.models.user import User
from app.models.visit import Visit
from app.ratelimit import default_rate_limit
from app.schemas.profile import (
    UserProfile,
    UserProfileResponse,
    UserProfileUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["profile"], dependencies=[Depends(default_rate_limit("profile"))]
)


async def _profile_response(session: AsyncSession, user: User) -> UserProfileResponse:
    visits_count = (
        await session.execute(
            select(func.count()).select_from(Visit).where(Visit.user_id == user.id)
        )
    ).scalar_one()
    return UserProfileResponse(
        **UserProfile.model_validate(user).model_dump(),
        visits_count=int(visits_count),
        taste_profile_trained=user.taste_profile_vector is not None,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfileResponse:
    return await _profile_response(session, user)


@router.patch("/me", response_model=UserProfileResponse)
async def update_me(
    update: UserProfileUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfileResponse:
    if update.display_name is not None:
        user.display_name = update.display_name.strip() or None
    dietary = update.validated_dietary()
    if dietary is not None:
        user.dietary_preferences = dietary
    if update.default_radius_m is not None:
        user.default_radius_m = update.default_radius_m
    if update.cuisine_likes is not None:
        user.cuisine_likes = [c.strip().lower() for c in update.cuisine_likes if c.strip()]
    if update.cuisine_dislikes is not None:
        user.cuisine_dislikes = [
            c.strip().lower() for c in update.cuisine_dislikes if c.strip()
        ]
    user.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return await _profile_response(session, user)


@router.delete("/me", status_code=204)
async def delete_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete the local account row (visits cascade). The Supabase Auth user
    must be deleted client-side / via Supabase admin — we only own our data."""
    await session.delete(user)
    await session.commit()
    logger.info("account deleted user=%s", user.id)
