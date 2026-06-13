from unittest.mock import AsyncMock

import pytest

from app.schemas.search import ParsedFilters, RestaurantResult


def _candidate(place_id: str, name: str, rating: float = 4.5) -> RestaurantResult:
    return RestaurantResult(
        google_place_id=place_id, name=name, rating=rating, lat=0.0, lng=0.0
    )


@pytest.fixture
def stubbed_pipeline(monkeypatch):
    monkeypatch.setattr(
        "app.routers.recommendations.parse_query",
        AsyncMock(return_value=ParsedFilters(cuisine="ramen")),
    )
    monkeypatch.setattr(
        "app.routers.recommendations.find_places",
        AsyncMock(
            return_value=[
                _candidate("g1", "Ramen A"),
                _candidate("g2", "Ramen B"),
                _candidate("g3", "Ramen C", rating=3.0),
            ]
        ),
    )
    monkeypatch.setattr(
        "app.routers.recommendations.upsert_many", AsyncMock()
    )
    monkeypatch.setattr(
        "app.routers.recommendations.dishes_by_place_ids",
        AsyncMock(return_value={"g1": ["tonkotsu"]}),
    )


@pytest.mark.asyncio
async def test_recommendations_anonymous_with_sonnet_picks(
    client, stubbed_pipeline, monkeypatch
):
    monkeypatch.setattr(
        "app.routers.recommendations.rank_candidates",
        AsyncMock(
            return_value=[
                ("g2", "A close match for your ramen craving."),
                ("g1", "Known for its tonkotsu."),
            ]
        ),
    )

    r = await client.post(
        "/recommendations", json={"query": "ramen", "lat": 1.0, "lng": 2.0}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["personalized"] is False
    assert body["cached"] is False
    assert [x["google_place_id"] for x in body["results"]] == ["g2", "g1"]
    assert body["results"][0]["explanation"] == "A close match for your ramen craving."
    assert body["results"][1]["popular_dishes"] == ["tonkotsu"]


@pytest.mark.asyncio
async def test_recommendations_fallback_when_sonnet_fails(
    client, stubbed_pipeline, monkeypatch
):
    monkeypatch.setattr(
        "app.routers.recommendations.rank_candidates", AsyncMock(return_value=None)
    )
    explain = AsyncMock()
    monkeypatch.setattr("app.routers.recommendations.explain_results", explain)

    r = await client.post(
        "/recommendations", json={"query": "ramen", "lat": 1.0, "lng": 2.0}
    )
    assert r.status_code == 200
    body = r.json()
    # falls back to the pre-rank pool order (cold-start /search-style ranking)
    assert [x["google_place_id"] for x in body["results"]] == ["g1", "g2", "g3"]
    explain.assert_awaited_once()


@pytest.mark.asyncio
async def test_recommendations_cached_on_repeat(client, stubbed_pipeline, monkeypatch):
    rank = AsyncMock(return_value=[("g1", "reason")])
    monkeypatch.setattr("app.routers.recommendations.rank_candidates", rank)

    body = {"query": "ramen", "lat": 1.0, "lng": 2.0}
    r1 = await client.post("/recommendations", json=body)
    r2 = await client.post("/recommendations", json=body)

    assert r1.json()["cached"] is False
    assert r2.json()["cached"] is True
    assert rank.await_count == 1


@pytest.mark.asyncio
async def test_recommendations_personalized_uses_taste_ranking(
    auth_client, stubbed_pipeline, monkeypatch
):
    client, user = auth_client
    user.taste_profile_vector = [1.0] + [0.0] * 1535
    user.cuisine_dislikes = []

    rank_by_taste = AsyncMock(
        return_value=[_candidate("g2", "Ramen B"), _candidate("g1", "Ramen A")]
    )
    monkeypatch.setattr("app.routers.recommendations.rank_by_taste", rank_by_taste)
    monkeypatch.setattr(
        "app.routers.recommendations.last_visits_context",
        AsyncMock(return_value=[{"restaurant": "Ramen Ya", "my_rating": 5}]),
    )
    rank = AsyncMock(return_value=[("g2", "Like Ramen Ya, which you loved.")])
    monkeypatch.setattr("app.routers.recommendations.rank_candidates", rank)

    r = await client.post(
        "/recommendations", json={"query": "ramen", "lat": 1.0, "lng": 2.0}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["personalized"] is True
    assert body["results"][0]["explanation"] == "Like Ramen Ya, which you loved."
    rank_by_taste.assert_awaited_once()
    # history flows into the Sonnet prompt
    assert rank.await_args.args[4] == [{"restaurant": "Ramen Ya", "my_rating": 5}]


@pytest.mark.asyncio
async def test_recommendations_filters_disliked_cuisines(
    auth_client, stubbed_pipeline, monkeypatch
):
    client, user = auth_client
    user.cuisine_dislikes = ["ramen"]

    monkeypatch.setattr(
        "app.routers.recommendations.find_places",
        AsyncMock(
            return_value=[
                RestaurantResult(
                    google_place_id="g1",
                    name="Ramen A",
                    cuisine="ramen",
                    lat=0.0,
                    lng=0.0,
                ),
                RestaurantResult(
                    google_place_id="g4",
                    name="Thai D",
                    cuisine="thai",
                    lat=0.0,
                    lng=0.0,
                ),
            ]
        ),
    )
    monkeypatch.setattr(
        "app.routers.recommendations.rank_candidates", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        "app.routers.recommendations.explain_results", AsyncMock()
    )

    r = await client.post(
        "/recommendations", json={"query": "dinner", "lat": 1.0, "lng": 2.0}
    )
    ids = [x["google_place_id"] for x in r.json()["results"]]
    assert ids == ["g4"]
