from collections.abc import AsyncIterator
from typing import Any

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db import get_session
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
