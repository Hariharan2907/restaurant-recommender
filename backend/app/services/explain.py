import json
import logging
import time

from app.config import get_settings
from app.llm import get_anthropic_client
from app.schemas.search import ParsedFilters, RestaurantResult

logger = logging.getLogger(__name__)

_EXPLAIN_SYSTEM_PROMPT = """You write a one-sentence explanation for each restaurant in a list, saying why it matches the user's search query.

Rules:
- Reply with JSON only. No prose, no markdown fences.
- Top-level keys are the restaurant id strings provided.
- Values are short, specific one-sentence explanations under 20 words.
- Reference concrete signals: cuisine, rating, ratings count, price tier, the user's vibe terms, or the address neighborhood.
- Never invent details (no opening hours, no menu items, no awards) - only use the metadata you are given.
- If you genuinely cannot find a real connection, write "Matches nearby."

Format:
{"<id1>": "<explanation>", "<id2>": "<explanation>"}"""


def _strip_markdown_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
    if s.endswith("```"):
        s = s[:-3].rstrip()
    return s


async def explain_results(
    query: str,
    parsed: ParsedFilters,
    results: list[RestaurantResult],
) -> None:
    """Attach a one-sentence .explanation to each result in place. Soft-fails to no-op."""
    if not results:
        return

    client = get_anthropic_client()
    if client is None:
        logger.warning("explain_results: no Anthropic client configured, skipping")
        return

    settings = get_settings()
    candidates = [
        {
            "id": r.google_place_id,
            "name": r.name,
            "rating": r.rating,
            "ratings_count": r.user_ratings_total,
            "price_tier": r.price_tier,
            "cuisine": r.cuisine,
            "address": r.address,
        }
        for r in results
    ]
    user_content = (
        f'Query: "{query}"\n'
        f"Parsed filters: {parsed.model_dump_json(exclude_none=True)}\n"
        f"Restaurants:\n{json.dumps(candidates, ensure_ascii=False)}"
    )

    started = time.perf_counter()
    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=_EXPLAIN_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.warning("explain_results: anthropic call failed: %s", exc)
        return

    latency_ms = int((time.perf_counter() - started) * 1000)
    raw = response.content[0].text if response.content else ""
    try:
        data = json.loads(_strip_markdown_fences(raw))
        if not isinstance(data, dict):
            raise ValueError("expected JSON object at top level")
    except Exception as exc:  # noqa: BLE001 — soft-fail on bad LLM output
        logger.warning("explain_results: invalid JSON (%s): %r", exc, raw[:200])
        return

    for r in results:
        explanation = data.get(r.google_place_id)
        if isinstance(explanation, str) and explanation.strip():
            r.explanation = explanation.strip()

    covered = sum(1 for r in results if r.explanation)
    logger.info(
        "explain_results ok latency_ms=%d covered=%d/%d",
        latency_ms,
        covered,
        len(results),
    )
