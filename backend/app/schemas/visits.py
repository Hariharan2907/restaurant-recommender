from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VisitCreate(BaseModel):
    google_place_id: str = Field(min_length=1, max_length=256)
    # Restaurant metadata so we can create the row if /search never upserted it
    # (e.g. the user logs a place found outside the app).
    restaurant_name: str | None = Field(default=None, max_length=200)
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lng: float | None = Field(default=None, ge=-180.0, le=180.0)
    cuisine: str | None = Field(default=None, max_length=80)

    mood: str | None = Field(default=None, max_length=80)
    dishes_ordered: list[str] = Field(default_factory=list, max_length=30)
    my_rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)
    visited_at: datetime | None = None


class VisitRestaurant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    google_place_id: str
    name: str
    cuisine: str | None = None


class VisitOut(BaseModel):
    id: UUID
    restaurant: VisitRestaurant
    mood: str | None = None
    dishes_ordered: list[str] = Field(default_factory=list)
    my_rating: int | None = None
    notes: str | None = None
    visited_at: datetime


class VisitListResponse(BaseModel):
    visits: list[VisitOut]
    total: int
    limit: int
    offset: int
