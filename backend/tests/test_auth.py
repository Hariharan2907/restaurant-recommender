import time
from typing import Any
from uuid import uuid4

import jwt
import pytest

import app.auth as auth_module
from app.auth import decode_token, get_current_user, get_optional_user
from app.config import get_settings
from app.main import app

HS_SECRET = "test-jwt-secret"


def _make_token(
    *,
    secret: str = HS_SECRET,
    sub: str | None = None,
    email: str = "user@example.com",
    aud: str = "authenticated",
    exp_offset_s: int = 3600,
) -> str:
    claims: dict[str, Any] = {
        "sub": sub or str(uuid4()),
        "email": email,
        "aud": aud,
        "exp": int(time.time()) + exp_offset_s,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def hs256_settings(monkeypatch):
    """Run auth tests against the HS256 (legacy secret) verification path."""
    settings = get_settings().model_copy(update={"supabase_jwt_secret": HS_SECRET})
    monkeypatch.setattr("app.auth.get_settings", lambda: settings)
    return settings


class _FakeUser:
    def __init__(self, sub: str, email: str) -> None:
        self.id = uuid4()
        self.supabase_sub = sub
        self.email = email


@pytest.fixture
def resolve_spy(monkeypatch):
    calls: list[dict] = []

    async def fake_resolve(_session, claims):
        calls.append(claims)
        return _FakeUser(claims["sub"], claims.get("email", ""))

    monkeypatch.setattr(auth_module, "_resolve_user", fake_resolve)
    return calls


@pytest.mark.asyncio
async def test_decode_token_valid_hs256():
    sub = str(uuid4())
    claims = await decode_token(_make_token(sub=sub))
    assert claims["sub"] == sub
    assert claims["email"] == "user@example.com"


@pytest.mark.asyncio
async def test_decode_token_rejects_bad_signature():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await decode_token(_make_token(secret="wrong-secret"))
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_decode_token_rejects_expired():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await decode_token(_make_token(exp_offset_s=-60))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "token_expired"


@pytest.mark.asyncio
async def test_decode_token_rejects_wrong_audience():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await decode_token(_make_token(aud="not-authenticated"))
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_rejects_missing_and_bad_tokens(client, resolve_spy):
    from fastapi import Depends

    @app.get("/_test_protected")
    async def _protected(user=Depends(get_current_user)):
        return {"sub": user.supabase_sub}

    try:
        r = await client.get("/_test_protected")
        assert r.status_code == 401

        r = await client.get(
            "/_test_protected", headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert r.status_code == 401

        sub = str(uuid4())
        r = await client.get(
            "/_test_protected",
            headers={"Authorization": f"Bearer {_make_token(sub=sub)}"},
        )
        assert r.status_code == 200
        assert r.json()["sub"] == sub
    finally:
        app.router.routes = [
            route
            for route in app.router.routes
            if getattr(route, "path", None) != "/_test_protected"
        ]


@pytest.mark.asyncio
async def test_optional_auth_passes_anonymous_but_rejects_invalid(client, resolve_spy):
    from fastapi import Depends

    @app.get("/_test_optional")
    async def _optional(user=Depends(get_optional_user)):
        return {"authenticated": user is not None}

    try:
        r = await client.get("/_test_optional")
        assert r.status_code == 200
        assert r.json() == {"authenticated": False}

        r = await client.get(
            "/_test_optional", headers={"Authorization": "Bearer garbage"}
        )
        assert r.status_code == 401

        r = await client.get(
            "/_test_optional", headers={"Authorization": f"Bearer {_make_token()}"}
        )
        assert r.status_code == 200
        assert r.json() == {"authenticated": True}
    finally:
        app.router.routes = [
            route
            for route in app.router.routes
            if getattr(route, "path", None) != "/_test_optional"
        ]


@pytest.mark.asyncio
async def test_decode_token_jwks_path(monkeypatch, respx_jwks=None):
    """JWKS (asymmetric) verification path with a locally generated ES256 key."""
    import respx
    from cryptography.hazmat.primitives.asymmetric import ec
    from httpx import Response

    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(
        private_key.public_key(), as_dict=True
    )
    public_jwk["kid"] = "test-kid"
    public_jwk["alg"] = "ES256"

    settings = get_settings().model_copy(
        update={
            "supabase_jwt_secret": "",
            "supabase_url": "https://proj.supabase.co",
        }
    )
    monkeypatch.setattr("app.auth.get_settings", lambda: settings)
    monkeypatch.setattr(auth_module, "_JWKS_CACHE", {"keys": None, "fetched_at": 0.0})

    sub = str(uuid4())
    token = jwt.encode(
        {
            "sub": sub,
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "test-kid"},
    )

    with respx.mock:
        respx.get("https://proj.supabase.co/auth/v1/.well-known/jwks.json").mock(
            return_value=Response(200, json={"keys": [public_jwk]})
        )
        claims = await decode_token(token)

    assert claims["sub"] == sub
