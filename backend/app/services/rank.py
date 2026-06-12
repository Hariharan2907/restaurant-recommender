"""Claude Sonnet re-rank for /recommendations (PLAN.md "Rank call").

Input: parsed query + top ~20 candidates + the user's last ~20 visits +
popular dishes per candidate + current mood. Output: top picks with a
one-sentence, history-aware reason each. Soft-fails to None.
"""

import json
import logging

from app.config import get_settings
from app.llm import get_anthropic_client, logged_messages_create
from app.schemas.recommendations import RecommendationResult
from app.schemas.search import ParsedFilters
from app.services.llm_json import strip_markdown_fences

logger = logging.getLogger(__name__)

_MAX_PICKS = 5

_RANK_SYSTEM_PROMPT = """You rank restaurants for a user based on their search, mood, and dining history.

You receive:
- the user's natural-language query and parsed filters
- their current mood (may be empty)
- their recent visits (restaurant, their own 1-5 rating, dishes they ordered, mood)
- a numbered list of candidate restaurants with metadata and popular dishes

Pick the best 5 candidates (fewer if fewer qualify) and order them best-first.

Rules:
- Reply with JSON only: {"picks": [{"id": "<candidate id>", "reason": "<one sentence>"}]}
- "id" must be copied exactly from a candidate. Never invent ids.
- Each reason is ONE sentence under 25 words, concrete and specific.
- Reference the user's history when relevant ("you rated Thai Basil 5 stars", "similar to the ramen spots you love").
- Use popular dishes when they connect to the query or history.
- Respect the mood and dietary needs. Never recommend a cuisine the user dislikes.
- Never invent details not present in the data."""


def _visit_context(visits: list[dict]) -> str:
    if not visits:
        return "No visit history (new user)."
    return json.dumps(visits, ensure_ascii=False, default=str)


async def rank_candidates(
    query: str,
    parsed: ParsedFilters,
    mood: str | None,
    candidates: list[RecommendationResult],
    visits: list[dict],
    dislikes: list[str] | None = None,
) -> list[tuple[str, str]] | None:
    """Returns ordered [(google_place_id, reason)] or None on soft-fail."""
    if not candidates:
        return []

    client = get_anthropic_client()
    if client is None:
        logger.warning("rank_candidates: no Anthropic client configured, skipping")
        return None

    settings = get_settings()
    candidate_payload = [
        {
            "id": c.google_place_id,
            "name": c.name,
            "cuisine": c.cuisine,
            "rating": c.rating,
            "ratings_count": c.user_ratings_total,
            "price_tier": c.price_tier,
            "address": c.address,
            "popular_dishes": c.popular_dishes,
        }
        for c in candidates
    ]
    user_content = (
        f'Query: "{query}"\n'
        f"Parsed filters: {parsed.model_dump_json(exclude_none=True)}\n"
        f"Mood: {mood or 'unspecified'}\n"
        f"Disliked cuisines: {json.dumps(dislikes or [])}\n"
        f"Recent visits:\n{_visit_context(visits)}\n"
        f"Candidates:\n{json.dumps(candidate_payload, ensure_ascii=False)}"
    )

    try:
        response = await logged_messages_create(
            client,
            "rank_candidates",
            model=settings.anthropic_rank_model,
            max_tokens=1024,
            system=_RANK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
            timeout=settings.anthropic_rank_timeout_s,
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.warning("rank_candidates: anthropic call failed: %s", exc)
        return None

    raw = response.content[0].text if response.content else ""
    try:
        data = json.loads(strip_markdown_fences(raw))
        picks = data["picks"]
        if not isinstance(picks, list):
            raise ValueError("picks is not a list")
    except Exception as exc:  # noqa: BLE001 — soft-fail on bad LLM output
        logger.warning("rank_candidates: invalid JSON (%s): %r", exc, raw[:200])
        return None

    valid_ids = {c.google_place_id for c in candidates}
    ordered: list[tuple[str, str]] = []
    seen: set[str] = set()
    for pick in picks:
        if not isinstance(pick, dict):
            continue
        pick_id = pick.get("id")
        reason = pick.get("reason")
        if pick_id in valid_ids and pick_id not in seen and isinstance(reason, str):
            ordered.append((pick_id, reason.strip()))
            seen.add(pick_id)
        if len(ordered) >= _MAX_PICKS:
            break

    logger.info("rank_candidates ok picks=%d/%d", len(ordered), len(candidates))
    return ordered
