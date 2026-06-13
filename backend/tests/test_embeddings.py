import pytest
import respx
from httpx import Response

from app.config import get_settings
from app.models.restaurant import Restaurant
from app.services.embeddings import (
    _pad,
    embed_texts,
    restaurant_embedding_text,
)


@pytest.fixture
def voyage_settings(monkeypatch):
    settings = get_settings().model_copy(update={"voyage_api_key": "test-voyage-key"})
    monkeypatch.setattr("app.services.embeddings.get_settings", lambda: settings)
    return settings


def test_pad_extends_with_zeros():
    assert _pad([1.0, 2.0], 4) == [1.0, 2.0, 0.0, 0.0]
    assert _pad([1.0, 2.0, 3.0], 2) == [1.0, 2.0]


@pytest.mark.asyncio
async def test_embed_texts_returns_padded_vectors(voyage_settings):
    raw = [0.1] * voyage_settings.voyage_output_dim
    with respx.mock:
        respx.post(voyage_settings.voyage_embeddings_url).mock(
            return_value=Response(
                200,
                json={"data": [{"index": 0, "embedding": raw}]},
            )
        )
        vectors = await embed_texts(["some restaurant"])

    assert vectors is not None
    assert len(vectors) == 1
    assert len(vectors[0]) == voyage_settings.embedding_dim  # padded to 1536
    assert vectors[0][: len(raw)] == raw
    assert all(v == 0.0 for v in vectors[0][len(raw):])


@pytest.mark.asyncio
async def test_embed_texts_soft_fails_without_key(monkeypatch):
    settings = get_settings().model_copy(update={"voyage_api_key": ""})
    monkeypatch.setattr("app.services.embeddings.get_settings", lambda: settings)
    assert await embed_texts(["x"]) is None


@pytest.mark.asyncio
async def test_embed_texts_soft_fails_on_http_error(voyage_settings):
    with respx.mock:
        respx.post(voyage_settings.voyage_embeddings_url).mock(
            return_value=Response(500)
        )
        assert await embed_texts(["x"]) is None


def test_restaurant_embedding_text_includes_metadata_and_dishes():
    restaurant = Restaurant(
        google_place_id="g1",
        name="Thai Basil",
        cuisine="thai",
        price_tier=2,
        lat=0.0,
        lng=0.0,
        rating=4.5,
        dietary_flags={"vegetarian": True, "vegan": False},
        vibe_tags=["cozy", "date-night"],
    )
    text = restaurant_embedding_text(restaurant, ["pad thai", "green curry"])
    assert "Thai Basil" in text
    assert "cuisine: thai" in text
    assert "price: $$" in text
    assert "vibe: cozy, date-night" in text
    assert "dietary: vegetarian" in text
    assert "vegan" not in text.split("dietary: ")[1].split(" | ")[0]
    assert "popular dishes: pad thai, green curry" in text
