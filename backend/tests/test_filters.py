from app.schemas.search import ParsedFilters, RestaurantResult
from app.services.filters import apply_filters


def _r(name: str, rating: float | None = None, price: int | None = None) -> RestaurantResult:
    return RestaurantResult(
        google_place_id=f"g-{name}",
        name=name,
        rating=rating,
        price_tier=price,
        lat=0.0,
        lng=0.0,
    )


def test_empty_filters_passes_everything_through():
    places = [_r("A", rating=3.0), _r("B", rating=4.5)]
    out = apply_filters(places, ParsedFilters())
    assert {p.name for p in out} == {"A", "B"}


def test_min_rating_drops_below_threshold():
    places = [_r("A", rating=3.0), _r("B", rating=4.5), _r("C", rating=None)]
    out = apply_filters(places, ParsedFilters(min_rating=4.0))
    # None rating fails the filter (we don't trust unknown ratings)
    assert {p.name for p in out} == {"B"}


def test_price_max_drops_above_threshold():
    places = [_r("A", price=1), _r("B", price=3), _r("C", price=None)]
    out = apply_filters(places, ParsedFilters(price_max=2))
    # None price passes (we don't have info to reject it)
    assert {p.name for p in out} == {"A", "C"}


def test_rating_at_boundary_passes():
    places = [_r("A", rating=4.0)]
    out = apply_filters(places, ParsedFilters(min_rating=4.0))
    assert len(out) == 1
