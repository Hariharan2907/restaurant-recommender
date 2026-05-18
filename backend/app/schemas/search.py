from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    radius_m: int = Field(default=3000, ge=100, le=20000)


class ParsedFilters(BaseModel):
    cuisine: str | None = None
    min_rating: float | None = Field(default=None, ge=0.0, le=5.0)
    vibe_tags: list[str] = Field(default_factory=list)
    dietary: list[str] = Field(default_factory=list)
    price_max: int | None = Field(default=None, ge=1, le=4)
    intent: str | None = None


class RestaurantResult(BaseModel):
    google_place_id: str
    name: str
    cuisine: str | None = None
    rating: float | None = None
    price_tier: int | None = None
    lat: float
    lng: float
    address: str | None = None
    photo_url: str | None = None
    distance_m: int | None = None


class SearchResponse(BaseModel):
    parsed_filters: ParsedFilters
    results: list[RestaurantResult]
    cached: bool
