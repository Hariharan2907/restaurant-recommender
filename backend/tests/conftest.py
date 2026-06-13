import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db import engine, get_session
from app.main import app


@pytest.fixture(autouse=True)
def shared_fake_redis(monkeypatch) -> FakeRedis:
    """Keep tests hermetic: rate limiting and /health never touch real Redis."""
    fake = FakeRedis(decode_responses=True)
    monkeypatch.setattr("app.ratelimit.get_redis", lambda: fake)
    monkeypatch.setattr("app.routers.health.get_redis", lambda: fake)
    monkeypatch.setattr("app.routers.search.get_redis", lambda: fake)
    monkeypatch.setattr("app.routers.visits.get_redis", lambda: fake)
    monkeypatch.setattr("app.routers.recommendations.get_redis", lambda: fake)
    monkeypatch.setattr("app.jobs.get_redis", lambda: fake)
    return fake


class _StubResult:
    def scalar_one(self) -> int:
        return 1


class _StubSession:
    async def execute(self, *_args: Any, **_kwargs: Any) -> _StubResult:
        return _StubResult()

    async def commit(self) -> None:
        pass

    async def rollback(self) -> None:
        pass

    def add(self, *_args: Any, **_kwargs: Any) -> None:
        pass

    async def refresh(self, *_args: Any, **_kwargs: Any) -> None:
        pass


async def _override_get_session() -> AsyncIterator[_StubSession]:
    yield _StubSession()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_session, None)


@pytest_asyncio.fixture
async def auth_client(db_session):
    """Client backed by the real rolled-back DB session and a signed-in user.

    Yields (client, user). Requires `make up` + `alembic upgrade head`.
    """
    from app.auth import get_current_user, get_optional_user
    from app.models.user import User

    user = User(email="me@example.com", supabase_sub="sub-me")
    db_session.add(user)
    await db_session.flush()

    async def _session_override() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = _session_override
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_optional_user] = lambda: user
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c, user
    finally:
        app.dependency_overrides.clear()


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def load_fixture():
    def _load(name: str) -> dict:
        return json.loads((FIXTURES_DIR / name).read_text())
    return _load


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Per-test DB session inside a transaction that always rolls back.

    Requires `make up` and `alembic upgrade head` to have been run.
    """
    async with engine.connect() as conn:
        trans = await conn.begin()
        session_factory = async_sessionmaker(conn, expire_on_commit=False)
        async_session = session_factory()
        try:
            yield async_session
        finally:
            await async_session.close()
            await trans.rollback()
