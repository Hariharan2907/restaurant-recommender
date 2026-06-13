import json
import logging
import time

from app.config import get_settings
from app.llm import get_anthropic_client
from app.schemas.search import ParsedFilters

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


def _strip_markdown_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
    if s.endswith("```"):
        s = s[:-3].rstrip()
    return s


async def parse_query(query: str) -> ParsedFilters:
    client = get_anthropic_client()
    if client is None:
        logger.warning("parse_query: no Anthropic client configured, returning empty filters")
        return ParsedFilters()

    settings = get_settings()
    started = time.perf_counter()
    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=512,
            system=_PARSE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.warning("parse_query: anthropic call failed: %s", exc)
        return ParsedFilters()

    latency_ms = int((time.perf_counter() - started) * 1000)
    raw = response.content[0].text if response.content else ""
    try:
        data = json.loads(_strip_markdown_fences(raw))
        parsed = ParsedFilters.model_validate(data)
    except Exception as exc:  # noqa: BLE001 — soft-fail on bad LLM output
        logger.warning("parse_query: invalid JSON from model (%s): %r", exc, raw[:200])
        return ParsedFilters()

    logger.info(
        "parse_query ok model=%s latency_ms=%d query=%r parsed=%s",
        settings.anthropic_model,
        latency_ms,
        query,
        parsed.model_dump(exclude_none=True),
    )
    return parsed
