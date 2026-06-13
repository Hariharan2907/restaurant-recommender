from app.schemas.search import ParsedFilters, RestaurantResult


def apply_filters(
    places: list[RestaurantResult],
    filters: ParsedFilters,
) -> list[RestaurantResult]:
    out: list[RestaurantResult] = []
    for p in places:
        if filters.min_rating is not None:
            if p.rating is None or p.rating < filters.min_rating:
                continue
        if filters.price_max is not None:
            if p.price_tier is not None and p.price_tier > filters.price_max:
                continue
        # dietary filters are not derivable from Google Places fields in Phase 2;
        # we keep the filter declared in the schema for forward-compat but don't
        # apply it here. Phase 4 will populate dietary_flags from review extraction.
        out.append(p)
    return out
