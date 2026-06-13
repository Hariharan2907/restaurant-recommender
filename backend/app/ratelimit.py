import logging
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request, status

from app.auth import get_optional_user
from app.cache import get_redis
from app.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)

_WINDOW_S = 60


def _client_ip(request: Request) -> str:
    # Railway (and most PaaS proxies) set X-Forwarded-For; the leftmost hop is
    # the client. Spoofable when not behind a proxy, but the per-user limit
    # still applies and local dev doesn't need IP accuracy.
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _hit(redis, key: str, window_s: int) -> tuple[int, int]:
    """Fixed-window counter. Returns (count, seconds_until_reset)."""
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_s)
    ttl = await redis.ttl(key)
    return count, max(int(ttl), 1)


def rate_limit(
    scope: str,
    *,
    user_per_min: Callable[[], int],
    ip_per_min: Callable[[], int],
) -> Callable[..., Awaitable[None]]:
    """Dependency factory: per-user (when authenticated) + per-IP limits in Redis.

    Limits are passed as callables so they read live settings (tests tweak them).
    Fails open if Redis is unreachable — availability beats strictness here.
    """

    async def dependency(
        request: Request,
        user: User | None = Depends(get_optional_user),
    ) -> None:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return

        redis = get_redis()
        checks: list[tuple[str, int]] = [
            (f"rl:{scope}:ip:{_client_ip(request)}", ip_per_min()),
        ]
        if user is not None:
            checks.append((f"rl:{scope}:user:{user.id}", user_per_min()))

        for key, limit in checks:
            try:
                count, reset_s = await _hit(redis, key, _WINDOW_S)
            except Exception as exc:  # noqa: BLE001 — fail open on Redis trouble
                logger.error("ratelimit: redis unavailable, allowing request: %s", exc)
                return
            if count > limit:
                logger.warning("ratelimit: blocked key=%s count=%d limit=%d", key, count, limit)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="rate_limited",
                    headers={"Retry-After": str(reset_s)},
                )

    return dependency


def search_rate_limit() -> Callable[..., Awaitable[None]]:
    return rate_limit(
        "search",
        user_per_min=lambda: get_settings().rate_limit_search_user_per_min,
        ip_per_min=lambda: get_settings().rate_limit_search_ip_per_min,
    )


def recommendations_rate_limit() -> Callable[..., Awaitable[None]]:
    return rate_limit(
        "recs",
        user_per_min=lambda: get_settings().rate_limit_recs_user_per_min,
        ip_per_min=lambda: get_settings().rate_limit_recs_ip_per_min,
    )


def default_rate_limit(scope: str) -> Callable[..., Awaitable[None]]:
    return rate_limit(
        scope,
        user_per_min=lambda: get_settings().rate_limit_default_user_per_min,
        ip_per_min=lambda: get_settings().rate_limit_default_ip_per_min,
    )
