import pytest

from app.models.restaurant import Restaurant

DIM = 1536


def _visit_payload(**overrides):
    payload = {
        "google_place_id": "g-new",
        "restaurant_name": "New Spot",
        "lat": 10.0,
        "lng": 10.0,
        "cuisine": "thai",
        "mood": "celebratory",
        "dishes_ordered": ["pad thai"],
        "my_rating": 5,
        "notes": "great",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_create_visit_creates_restaurant_and_returns_visit(auth_client):
    client, user = auth_client
    r = await client.post("/visits", json=_visit_payload())
    assert r.status_code == 201
    body = r.json()
    assert body["restaurant"]["google_place_id"] == "g-new"
    assert body["restaurant"]["name"] == "New Spot"
    assert body["my_rating"] == 5
    assert body["dishes_ordered"] == ["pad thai"]
    assert body["visited_at"] is not None


@pytest.mark.asyncio
async def test_create_visit_existing_restaurant_needs_no_metadata(
    auth_client, db_session
):
    client, user = auth_client
    db_session.add(
        Restaurant(google_place_id="g-known", name="Known", lat=1.0, lng=1.0)
    )
    await db_session.flush()

    r = await client.post(
        "/visits", json={"google_place_id": "g-known", "my_rating": 4}
    )
    assert r.status_code == 201
    assert r.json()["restaurant"]["name"] == "Known"


@pytest.mark.asyncio
async def test_create_visit_unknown_restaurant_without_metadata_422(auth_client):
    client, user = auth_client
    r = await client.post("/visits", json={"google_place_id": "g-mystery"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_visit_refreshes_taste_profile(auth_client, db_session):
    client, user = auth_client
    embedding = [0.0] * DIM
    embedding[0] = 1.0
    db_session.add(
        Restaurant(
            google_place_id="g-embedded",
            name="Embedded",
            lat=1.0,
            lng=1.0,
            embedding=embedding,
        )
    )
    await db_session.flush()

    assert user.taste_profile_vector is None
    r = await client.post(
        "/visits", json={"google_place_id": "g-embedded", "my_rating": 5}
    )
    assert r.status_code == 201
    assert user.taste_profile_vector is not None


@pytest.mark.asyncio
async def test_list_visits_paginates_newest_first(auth_client):
    client, user = auth_client
    for i in range(3):
        await client.post(
            "/visits",
            json=_visit_payload(
                google_place_id=f"g-{i}",
                restaurant_name=f"Spot {i}",
                visited_at=f"2026-06-0{i + 1}T12:00:00Z",
            ),
        )

    r = await client.get("/visits", params={"limit": 2, "offset": 0})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 3
    assert [v["restaurant"]["name"] for v in body["visits"]] == ["Spot 2", "Spot 1"]

    r2 = await client.get("/visits", params={"limit": 2, "offset": 2})
    assert [v["restaurant"]["name"] for v in r2.json()["visits"]] == ["Spot 0"]


@pytest.mark.asyncio
async def test_delete_visit_and_ownership(auth_client, db_session):
    from app.models.user import User
    from app.models.visit import Visit

    client, user = auth_client
    create = await client.post("/visits", json=_visit_payload())
    visit_id = create.json()["id"]

    # another user's visit is invisible
    other = User(email="other@example.com", supabase_sub="sub-other")
    db_session.add(other)
    await db_session.flush()
    restaurant_id = (
        await db_session.execute(
            Restaurant.__table__.select().where(
                Restaurant.google_place_id == "g-new"
            )
        )
    ).first().id
    other_visit = Visit(user_id=other.id, restaurant_id=restaurant_id)
    db_session.add(other_visit)
    await db_session.flush()

    r = await client.delete(f"/visits/{other_visit.id}")
    assert r.status_code == 404

    r = await client.delete(f"/visits/{visit_id}")
    assert r.status_code == 204

    r = await client.get("/visits")
    assert r.json()["total"] == 0


@pytest.mark.asyncio
async def test_visits_require_auth(client):
    assert (await client.get("/visits")).status_code == 401
    assert (
        await client.post("/visits", json={"google_place_id": "x"})
    ).status_code == 401
