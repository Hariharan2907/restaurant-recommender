import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db import engine, get_session
from app.main import app


class _StubResult:
    def scalar_one(self) -> int:
        return 1


class _StubSession:
    async def execute(self, *_args: Any, **_kwargs: Any) -> _StubResult:
        return _StubResult()


async def _override_get_session() -> AsyncIterator[_StubSession]:
    yield _StubSession()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_session, None)


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
