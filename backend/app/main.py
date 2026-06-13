import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_logging
from app.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.routers import (
    discover,
    health,
    me,
    photos,
    recommendations,
    restaurants,
    search,
    visits,
)

settings = get_settings()
configure_logging(settings)
logger = logging.getLogger(__name__)

if settings.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

app = FastAPI(
    title="Fork API",
    version="0.2.0",
)

# CORS: explicit origins only — never "*" alongside allow_credentials=True.
assert "*" not in settings.cors_origins, "wildcard CORS origin is not allowed"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(
    SecurityHeadersMiddleware, hsts=settings.environment == "production"
)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Never leak internals to the client; the traceback goes to the logs only.
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "internal_error"})


app.include_router(health.router)
app.include_router(search.router)
app.include_router(photos.router)
app.include_router(me.router)
app.include_router(visits.router)
app.include_router(recommendations.router)
app.include_router(discover.router)
app.include_router(restaurants.router)
