import logging

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.config import get_settings
from app.db import get_session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> JSONResponse:
    settings = get_settings()
    checks: dict[str, str] = {}
    errors: dict[str, str] = {}

    try:
        result = await session.execute(text("SELECT 1"))
        result.scalar_one()
        checks["db"] = "ok"
    except Exception as exc:  # noqa: BLE001 — health must report, not crash
        checks["db"] = "error"
        errors["db"] = str(exc)

    try:
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = "error"
        errors["redis"] = str(exc)

    healthy = all(v == "ok" for v in checks.values())
    content: dict[str, object] = {"status": "ok" if healthy else "error", **checks}
    if errors:
        logger.error("health check failed: %s", errors)
        # Raw exception strings can leak hosts/credentials — dev only.
        if settings.environment != "production":
            content["errors"] = errors

    return JSONResponse(
        status_code=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=content,
    )
