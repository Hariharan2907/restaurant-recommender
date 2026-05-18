import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.search import ParsedFilters
from app.services.parse import parse_query


def _make_anthropic_response(payload: dict | str) -> SimpleNamespace:
    """Mimic the shape of anthropic.types.Message: .content[0].text"""
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


@pytest.mark.asyncio
async def test_parse_query_happy_path(monkeypatch, load_fixture):
    payload = load_fixture("claude_parse_indian.json")
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(return_value=_make_anthropic_response(payload)))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("cozy indian spot 4 stars vegetarian")
    assert result.cuisine == "indian"
    assert result.min_rating == 4.0
    assert "cozy" in result.vibe_tags
    assert "vegetarian" in result.dietary


@pytest.mark.asyncio
async def test_parse_query_returns_empty_on_invalid_json(monkeypatch):
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(return_value=_make_anthropic_response("not json {{{")))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("anything")
    assert result == ParsedFilters()


@pytest.mark.asyncio
async def test_parse_query_returns_empty_when_no_client(monkeypatch):
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: None)

    result = await parse_query("anything")
    assert result == ParsedFilters()


@pytest.mark.asyncio
async def test_parse_query_returns_empty_on_api_exception(monkeypatch):
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(side_effect=RuntimeError("boom")))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("anything")
    assert result == ParsedFilters()


@pytest.mark.asyncio
async def test_parse_query_strips_markdown_fences(monkeypatch):
    fenced = '```json\n{"cuisine": "ramen", "min_rating": 4.0, "vibe_tags": ["cozy"]}\n```'
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(return_value=_make_anthropic_response(fenced)))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("cozy ramen 4 stars")
    assert result.cuisine == "ramen"
    assert result.min_rating == 4.0
    assert result.vibe_tags == ["cozy"]


@pytest.mark.asyncio
async def test_parse_query_strips_plain_triple_backtick_fences(monkeypatch):
    fenced = '```\n{"cuisine": "thai"}\n```'
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(return_value=_make_anthropic_response(fenced)))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("thai")
    assert result.cuisine == "thai"
