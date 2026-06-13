import math

import pytest

from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.visit import Visit
from app.services.taste import refresh_taste_profile, weighted_mean

DIM = 1536


def _unit(axis: int) -> list[float]:
    v = [0.0] * DIM
    v[axis] = 1.0
    return v


def test_weighted_mean_weights_dominate():
    # 5-star on axis 0, 1-star on axis 1 -> profile leans heavily to axis 0
    profile = weighted_mean([_unit(0), _unit(1)], [5.0, 1.0])
    assert profile is not None
    assert profile[0] > profile[1] > 0
    norm = math.sqrt(sum(x * x for x in profile))
    assert norm == pytest.approx(1.0)


def test_weighted_mean_empty_returns_none():
    assert weighted_mean([], []) is None
    assert weighted_mean([_unit(0)], [0.0]) is None


@pytest.mark.asyncio
async def test_refresh_taste_profile_from_visits(db_session):
    user = User(email="taste@example.com", supabase_sub="sub-taste")
    loved = Restaurant(
        google_place_id="g-loved", name="Loved", lat=0.0, lng=0.0, embedding=_unit(0)
    )
    hated = Restaurant(
        google_place_id="g-hated", name="Hated", lat=0.0, lng=0.0, embedding=_unit(1)
    )
    no_embedding = Restaurant(
        google_place_id="g-bare", name="Bare", lat=0.0, lng=0.0
    )
    db_session.add_all([user, loved, hated, no_embedding])
    await db_session.flush()

    db_session.add_all(
        [
            Visit(user_id=user.id, restaurant_id=loved.id, my_rating=5),
            Visit(user_id=user.id, restaurant_id=hated.id, my_rating=1),
            Visit(user_id=user.id, restaurant_id=no_embedding.id, my_rating=5),
        ]
    )
    await db_session.flush()

    assert await refresh_taste_profile(db_session, user) is True
    profile = list(user.taste_profile_vector)
    assert profile[0] > profile[1] > 0.0


@pytest.mark.asyncio
async def test_refresh_taste_profile_no_visits_clears_vector(db_session):
    user = User(
        email="cold@example.com", supabase_sub="sub-cold", taste_profile_vector=_unit(3)
    )
    db_session.add(user)
    await db_session.flush()

    assert await refresh_taste_profile(db_session, user) is False
    assert user.taste_profile_vector is None
