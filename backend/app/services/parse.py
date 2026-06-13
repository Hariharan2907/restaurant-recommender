import json
import logging

from app.config import get_settings
from app.llm import get_anthropic_client, logged_messages_create
from app.schemas.search import ParsedFilters
from app.services.llm_json import strip_markdown_fences

logger = logging.getLogger(__name__)

_PARSE_SYSTEM_PROMPT = """You convert a user's natural-language restaurant search into structured filters.

Return ONLY a JSON object with these keys (omit any that don't apply, do not invent values):
- cuisine: string | null  (e.g. "indian", "ramen", "pizza")
- min_rating: number | null  (0.0 to 5.0)
- vibe_tags: string[]  (e.g. ["cozy", "date-night", "healthy", "fast"])
- dietary: string[]  (subset of ["vegetarian", "vegan", "gluten_free"])
- price_max: integer | null  (1=$, 2=$$, 3=$$$, 4=$$$$)
- intent: string | null  ("eat-now" | "explore" | "plan-later")

Reply with the JSON only, no prose, no markdown fences."""


async def parse_query(query: str) -> ParsedFilters:
    client = get_anthropic_client()
    if client is None:
        logger.warning("parse_query: no Anthropic client configured, returning empty filters")
        return ParsedFilters()

    settings = get_settings()
    try:
        response = await logged_messages_create(
            client,
            "parse_query",
            model=settings.anthropic_model,
            max_tokens=512,
            system=_PARSE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.warning("parse_query: anthropic call failed: %s", exc)
        return ParsedFilters()

    raw = response.content[0].text if response.content else ""
    try:
        data = json.loads(strip_markdown_fences(raw))
        parsed = ParsedFilters.model_validate(data)
    except Exception as exc:  # noqa: BLE001 — soft-fail on bad LLM output
        logger.warning("parse_query: invalid JSON from model (%s): %r", exc, raw[:200])
        return ParsedFilters()

    logger.info(
        "parse_query ok query=%r parsed=%s",
        query,
        parsed.model_dump(exclude_none=True),
    )
    return parsed
