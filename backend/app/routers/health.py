from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> JSONResponse:
    try:
        result = await session.execute(text("SELECT 1"))
        result.scalar_one()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "db": "error",
                "redis": "skipped",
                "error": str(exc),
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "ok", "db": "ok", "redis": "skipped"},
    )
