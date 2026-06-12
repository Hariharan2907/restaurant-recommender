from pydantic import BaseModel, Field

from app.schemas.search import ParsedFilters, RestaurantResult


class RecommendationsRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    radius_m: int | None = Field(default=None, ge=100, le=20000)
    mood: str | None = Field(default=None, max_length=80)


class RecommendationResult(RestaurantResult):
    popular_dishes: list[str] = Field(default_factory=list)


class RecommendationsResponse(BaseModel):
    parsed_filters: ParsedFilters
    results: list[RecommendationResult]
    personalized: bool
    cached: bool
