import logging
import time
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models.user import User

logger = logging.getLogger(__name__)

# Supabase signs access tokens either with the legacy project JWT secret
# (HS256) or with asymmetric signing keys published at the JWKS endpoint.
_ASYMMETRIC_ALGS = ["ES256", "RS256"]

_JWKS_CACHE: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL_S = 3600.0


class AuthError(HTTPException):
    def __init__(self, detail: str = "invalid_token") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization")
    if not header:
        return None
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise AuthError("invalid_authorization_header")
    return token.strip()


def _jwks_url() -> str:
    settings = get_settings()
    if settings.supabase_jwks_url:
        return settings.supabase_jwks_url
    if not settings.supabase_url:
        raise AuthError("auth_not_configured")
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


async def _get_jwks(force_refresh: bool = False) -> list[dict[str, Any]]:
    now = time.monotonic()
    cached = _JWKS_CACHE["keys"]
    if (
        not force_refresh
        and cached is not None
        and now - _JWKS_CACHE["fetched_at"] < _JWKS_TTL_S
    ):
        return cached
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_jwks_url())
            resp.raise_for_status()
            keys = resp.json().get("keys", [])
    except httpx.HTTPError as exc:
        logger.error("auth: JWKS fetch failed: %s", exc)
        if cached is not None:
            return cached  # stale keys beat no keys
        raise AuthError("auth_unavailable") from exc
    _JWKS_CACHE["keys"] = keys
    _JWKS_CACHE["fetched_at"] = now
    return keys


async def decode_token(token: str) -> dict[str, Any]:
    """Verify a Supabase access token and return its claims (401 on failure)."""
    settings = get_settings()
    options = {"require": ["exp", "sub"]}
    try:
        if settings.supabase_jwt_secret:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_aud,
                options=options,
            )

        kid = jwt.get_unverified_header(token).get("kid")
        keys = await _get_jwks()
        key_data = next((k for k in keys if k.get("kid") == kid), None)
        if key_data is None:
            # Key rotation: refresh once before rejecting.
            keys = await _get_jwks(force_refresh=True)
            key_data = next((k for k in keys if k.get("kid") == kid), None)
        if key_data is None:
            raise AuthError("unknown_signing_key")
        return jwt.decode(
            token,
            jwt.PyJWK(key_data).key,
            algorithms=_ASYMMETRIC_ALGS,
            audience=settings.supabase_jwt_aud,
            options=options,
        )
    except AuthError:
        raise
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("token_expired") from exc
    except jwt.PyJWTError as exc:
        logger.info("auth: token rejected: %s", exc)
        raise AuthError() from exc


async def _resolve_user(session: AsyncSession, claims: dict[str, Any]) -> User:
    """Find or create the local users row matching the Supabase identity."""
    sub = str(claims["sub"])
    email = (claims.get("email") or "").lower()

    result = await session.execute(select(User).where(User.supabase_sub == sub))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    if email:
        result = await session.execute(
            select(User).where(User.email == email, User.supabase_sub.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is not None:
            user.supabase_sub = sub
            await session.commit()
            return user

    user = User(supabase_sub=sub, email=email)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    """Require a valid Supabase JWT and return the matching local user."""
    token = _bearer_token(request)
    if token is None:
        raise AuthError("missing_token")
    claims = await decode_token(token)
    return await _resolve_user(session, claims)


async def get_optional_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Like get_current_user but anonymous requests pass through as None.

    A *presented* token must still be valid (401 otherwise) so clients learn
    their session expired instead of silently losing personalization.
    """
    token = _bearer_token(request)
    if token is None:
        return None
    claims = await decode_token(token)
    try:
        return await _resolve_user(session, claims)
    except Exception as exc:  # noqa: BLE001 — soft-fail: DB trouble must not break public endpoints
        logger.error("auth: user resolution failed (continuing anonymous): %s", exc)
        return None
