from app.config import get_settings
from app.llm import get_anthropic_client


def test_get_anthropic_client_returns_cached_instance_when_key_set(monkeypatch):
    get_anthropic_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key")

    a = get_anthropic_client()
    b = get_anthropic_client()
    assert a is not None
    assert a is b

    get_anthropic_client.cache_clear()
    get_settings.cache_clear()


def test_get_anthropic_client_returns_none_when_no_key(monkeypatch):
    get_anthropic_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")

    assert get_anthropic_client() is None

    get_anthropic_client.cache_clear()
    get_settings.cache_clear()
