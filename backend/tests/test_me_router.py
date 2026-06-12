import pytest


@pytest.mark.asyncio
async def test_get_me_returns_profile(auth_client):
    client, user = auth_client
    r = await client.get("/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "me@example.com"
    assert body["visits_count"] == 0
    assert body["taste_profile_trained"] is False
    assert body["default_radius_m"] == 3000


@pytest.mark.asyncio
async def test_patch_me_updates_preferences(auth_client):
    client, user = auth_client
    r = await client.patch(
        "/me",
        json={
            "display_name": "  Hari ",
            "dietary_preferences": ["vegetarian", "not-a-real-diet"],
            "default_radius_m": 5000,
            "cuisine_likes": ["Thai", " ramen "],
            "cuisine_dislikes": ["sushi"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["display_name"] == "Hari"
    assert body["dietary_preferences"] == ["vegetarian"]  # invalid value dropped
    assert body["default_radius_m"] == 5000
    assert body["cuisine_likes"] == ["thai", "ramen"]
    assert body["cuisine_dislikes"] == ["sushi"]


@pytest.mark.asyncio
async def test_patch_me_partial_update_leaves_other_fields(auth_client):
    client, user = auth_client
    await client.patch("/me", json={"display_name": "Hari"})
    r = await client.patch("/me", json={"default_radius_m": 1000})
    body = r.json()
    assert body["display_name"] == "Hari"
    assert body["default_radius_m"] == 1000


@pytest.mark.asyncio
async def test_delete_me_removes_account(auth_client, db_session):
    from sqlalchemy import select

    from app.models.user import User

    client, user = auth_client
    r = await client.delete("/me")
    assert r.status_code == 204

    found = (
        await db_session.execute(select(User).where(User.id == user.id))
    ).scalar_one_or_none()
    assert found is None


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    assert (await client.get("/me")).status_code == 401
    assert (await client.patch("/me", json={})).status_code == 401
    assert (await client.delete("/me")).status_code == 401
