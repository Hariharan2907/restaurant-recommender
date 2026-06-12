"""Fetch and store raw reviews from Google Places and Yelp Fusion.

Runs in the background worker only — never in the request path (PLAN.md).
A Redis marker (30-day TTL) gates refetching per restaurant. Yelp content
must carry attribution when displayed; we record `source` per review so the
client can do that.
"""

import logging
from datetime import datetime

import httpx

from app.config import get_settings
from app.models.restaurant import Restaurant
from app.models.review import ReviewRaw

logger = logging.getLogger(__name__)

_MAX_REVIEWS_PER_SOURCE = 25


def reviews_fetched_marker(restaurant_id: str) -> str:
    return f"reviews_fetched:{restaurant_id}"


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def fetch_google_reviews(place_id: str) -> list[dict]:
    """Place Details (New) returns up to 5 of the most relevant reviews."""
    settings = get_settings()
    if not settings.google_places_api_key:
        logger.warning("fetch_google_reviews: no Google API key configured")
        return []

    url = f"https://places.googleapis.com/v1/places/{place_id}"
    headers = {
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": "reviews",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.google_places_timeout_s) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("fetch_google_reviews failed place=%s: %s", place_id, exc)
        return []

    reviews = []
    for raw in (payload.get("reviews") or [])[:_MAX_REVIEWS_PER_SOURCE]:
        text = ((raw.get("text") or {}).get("text") or "").strip()
        if not text:
            continue
        reviews.append(
            {
                "source": "google",
                "text": text,
                "rating": raw.get("rating"),
                "review_date": _parse_iso(raw.get("publishTime")),
            }
        )
    return reviews


async def fetch_yelp_reviews(name: str, lat: float, lng: float) -> list[dict]:
    """Match the business on Yelp, then pull its review excerpts (up to 3)."""
    settings = get_settings()
    if not settings.yelp_api_key:
        logger.info("fetch_yelp_reviews: no Yelp API key configured, skipping")
        return []

    headers = {"Authorization": f"Bearer {settings.yelp_api_key}"}
    base = settings.yelp_api_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=settings.yelp_timeout_s) as client:
            match_resp = await client.get(
                f"{base}/businesses/search",
                headers=headers,
                params={
                    "term": name,
                    "latitude": lat,
                    "longitude": lng,
                    "limit": 1,
                },
            )
            match_resp.raise_for_status()
            businesses = match_resp.json().get("businesses", [])
            if not businesses:
                return []
            business_id = businesses[0]["id"]

            reviews_resp = await client.get(
                f"{base}/businesses/{business_id}/reviews", headers=headers
            )
            reviews_resp.raise_for_status()
            raw_reviews = reviews_resp.json().get("reviews", [])
    except httpx.HTTPError as exc:
        logger.warning("fetch_yelp_reviews failed name=%r: %s", name, exc)
        return []

    reviews = []
    for raw in raw_reviews[:_MAX_REVIEWS_PER_SOURCE]:
        text = (raw.get("text") or "").strip()
        if not text:
            continue
        reviews.append(
            {
                "source": "yelp",
                "text": text,
                "rating": raw.get("rating"),
                "review_date": _parse_iso(raw.get("time_created")),
            }
        )
    return reviews


async def store_reviews(session, restaurant: Restaurant, reviews: list[dict]) -> int:
    """Replace-by-source insert: clears a source's old rows before adding new."""
    if not reviews:
        return 0
    from sqlalchemy import delete

    sources = {r["source"] for r in reviews}
    await session.execute(
        delete(ReviewRaw).where(
            ReviewRaw.restaurant_id == restaurant.id,
            ReviewRaw.source.in_(sources),
        )
    )
    for review in reviews:
        session.add(
            ReviewRaw(
                restaurant_id=restaurant.id,
                source=review["source"],
                text=review["text"],
                rating=review.get("rating"),
                review_date=review.get("review_date"),
            )
        )
    return len(reviews)
