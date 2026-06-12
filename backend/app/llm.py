import json
import logging
import time
from functools import lru_cache
from typing import Any

from anthropic import AsyncAnthropic
from anthropic.types import Message

from app.config import get_settings

logger = logging.getLogger(__name__)

_LOG_TEXT_LIMIT = 500


@lru_cache(maxsize=1)
def get_anthropic_client() -> AsyncAnthropic | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    return AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.anthropic_timeout_s,
    )


def _truncate(value: Any) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    return text[:_LOG_TEXT_LIMIT] + ("…" if len(text) > _LOG_TEXT_LIMIT else "")


async def logged_messages_create(
    client: AsyncAnthropic, purpose: str, **kwargs: Any
) -> Message:
    """client.messages.create with per-call input/output/latency logging (PLAN.md).

    Raises on failure — callers keep their own soft-fail handling.
    """
    started = time.perf_counter()
    try:
        response = await client.messages.create(**kwargs)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        logger.warning(
            "anthropic call FAILED purpose=%s model=%s latency_ms=%d error=%s",
            purpose,
            kwargs.get("model"),
            latency_ms,
            exc,
        )
        raise

    latency_ms = int((time.perf_counter() - started) * 1000)
    output_text = response.content[0].text if response.content else ""
    usage = getattr(response, "usage", None)
    logger.info(
        "anthropic call ok purpose=%s model=%s latency_ms=%d input_tokens=%s output_tokens=%s",
        purpose,
        kwargs.get("model"),
        latency_ms,
        getattr(usage, "input_tokens", None),
        getattr(usage, "output_tokens", None),
    )
    logger.debug(
        "anthropic call detail purpose=%s input=%s output=%s",
        purpose,
        _truncate(kwargs.get("messages", "")),
        _truncate(output_text),
    )
    return response
