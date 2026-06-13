import pytest

from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.search import RestaurantResult
from app.services.personalize import (
    cosine_similarity,
    discover_similar,
    rank_by_taste,
)

DIM = 1536


def _unit(axis: int) -> list[float]:
    v = [0.0] * DIM
    v[axis] = 1.0
    return v


def test_cosine_similarity_basics():
    assert cosine_similarity(_unit(0), _unit(0)) == pytest.approx(1.0)
    assert cosine_similarity(_unit(0), _unit(1)) == pytest.approx(0.0)
    assert cosine_similarity([0.0] * DIM, _unit(0)) == 0.0


def _result(place_id: str) -> RestaurantResult:
    return RestaurantResult(google_place_id=place_id, name=place_id, lat=0.0, lng=0.0)


@pytest.mark.asyncio
async def test_rank_by_taste_orders_by_similarity(db_session):
    user = User(
        email="rank@example.com", supabase_sub="sub-rank", taste_profile_vector=_unit(0)
    )
    close = Restaurant(
        google_place_id="g-close", name="Close", lat=0.0, lng=0.0, embedding=_unit(0)
    )
    far = Restaurant(
        google_place_id="g-far", name="Far", lat=0.0, lng=0.0, embedding=_unit(1)
    )
    db_session.add_all([user, close, far])
    await db_session.flush()

    candidates = [_result("g-far"), _result("g-close"), _result("g-unknown")]
    ordered = await rank_by_taste(db_session, user, candidates)

    assert [c.google_place_id for c in ordered] == ["g-close", "g-far", "g-unknown"]


@pytest.mark.asyncio
async def test_rank_by_taste_no_profile_keeps_order(db_session):
    user = User(email="noprof@example.com", supabase_sub="sub-noprof")
    db_session.add(user)
    await db_session.flush()

    candidates = [_result("a"), _result("b")]
    assert await rank_by_taste(db_session, user, candidates) == candidates


@pytest.mark.asyncio
async def test_discover_similar_personalized_and_dislike_filter(db_session):
    user = User(
        email="disc@example.com",
        supabase_sub="sub-disc",
        taste_profile_vector=_unit(0),
        cuisine_dislikes=["sushi"],
    )
    match = Restaurant(
        google_place_id="g-match",
        name="Match",
        cuisine="thai",
        lat=10.0,
        lng=10.0,
        embedding=_unit(0),
    )
    disliked = Restaurant(
        google_place_id="g-sushi",
        name="Sushi Spot",
        cuisine="sushi",
        lat=10.0,
        lng=10.0,
        embedding=_unit(0),
    )
    far_away = Restaurant(
        google_place_id="g-elsewhere",
        name="Elsewhere",
        cuisine="thai",
        lat=50.0,
        lng=50.0,
        embedding=_unit(0),
    )
    db_session.add_all([user, match, disliked, far_away])
    await db_session.flush()

    results, personalized = await discover_similar(
        db_session, user, lat=10.0, lng=10.0, radius_m=5000, limit=10
    )

    assert personalized is True
    ids = [r.google_place_id for r in results]
    assert "g-match" in ids
    assert "g-sushi" not in ids  # disliked cuisine filtered
    assert "g-elsewhere" not in ids  # outside radius


@pytest.mark.asyncio
async def test_discover_similar_cold_start_falls_back_to_rating(db_session):
    user = User(email="cold2@example.com", supabase_sub="sub-cold2")
    best = Restaurant(
        google_place_id="g-best", name="Best", rating=4.9, lat=20.0, lng=20.0
    )
    okay = Restaurant(
        google_place_id="g-okay", name="Okay", rating=3.2, lat=20.0, lng=20.0
    )
    db_session.add_all([user, best, okay])
    await db_session.flush()

    results, personalized = await discover_similar(
        db_session, user, lat=20.0, lng=20.0, radius_m=5000, limit=10
    )

    assert personalized is False
    assert [r.google_place_id for r in results][:2] == ["g-best", "g-okay"]
