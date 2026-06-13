import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.recommendations import RecommendationResult
from app.schemas.search import ParsedFilters
from app.services.rank import rank_candidates


def _candidate(place_id: str, name: str) -> RecommendationResult:
    return RecommendationResult(
        google_place_id=place_id, name=name, lat=0.0, lng=0.0,
        popular_dishes=["dish a"],
    )


def _anthropic_response(payload) -> SimpleNamespace:
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


def _mock_client(payload) -> SimpleNamespace:
    return SimpleNamespace(
        messages=SimpleNamespace(
            create=AsyncMock(return_value=_anthropic_response(payload))
        )
    )


@pytest.mark.asyncio
async def test_rank_candidates_orders_and_filters_picks(monkeypatch):
    client = _mock_client(
        {
            "picks": [
                {"id": "g2", "reason": "You rated similar ramen spots 5 stars."},
                {"id": "g1", "reason": "Matches your cozy vibe."},
                {"id": "g-INVENTED", "reason": "Should be dropped."},
                {"id": "g2", "reason": "Duplicate should be dropped."},
            ]
        }
    )
    monkeypatch.setattr("app.services.rank.get_anthropic_client", lambda: client)

    picks = await rank_candidates(
        "cozy ramen",
        ParsedFilters(cuisine="ramen"),
        "cozy",
        [_candidate("g1", "A"), _candidate("g2", "B")],
        visits=[{"restaurant": "Ramen Ya", "my_rating": 5}],
    )

    assert picks == [
        ("g2", "You rated similar ramen spots 5 stars."),
        ("g1", "Matches your cozy vibe."),
    ]


@pytest.mark.asyncio
async def test_rank_candidates_soft_fails_on_bad_json(monkeypatch):
    monkeypatch.setattr(
        "app.services.rank.get_anthropic_client", lambda: _mock_client("not json")
    )
    picks = await rank_candidates(
        "q", ParsedFilters(), None, [_candidate("g1", "A")], visits=[]
    )
    assert picks is None


@pytest.mark.asyncio
async def test_rank_candidates_soft_fails_without_client(monkeypatch):
    monkeypatch.setattr("app.services.rank.get_anthropic_client", lambda: None)
    picks = await rank_candidates(
        "q", ParsedFilters(), None, [_candidate("g1", "A")], visits=[]
    )
    assert picks is None


@pytest.mark.asyncio
async def test_rank_candidates_empty_candidates_short_circuits(monkeypatch):
    monkeypatch.setattr("app.services.rank.get_anthropic_client", lambda: None)
    assert await rank_candidates("q", ParsedFilters(), None, [], visits=[]) == []
