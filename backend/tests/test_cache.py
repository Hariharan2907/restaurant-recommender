import pytest

from app.cache import quantize_coord, search_key, places_key


def test_quantize_coord_3_decimals():
    assert quantize_coord(40.12345) == 40.123
    assert quantize_coord(40.12389) == 40.124
    assert quantize_coord(-122.41999) == -122.420


def test_search_key_normalizes_query_case_and_whitespace():
    a = search_key("  Cozy Ramen  ", 40.1234, -122.4198, 3000)
    b = search_key("cozy ramen", 40.1234, -122.4199, 3000)
    assert a == b


def test_search_key_differs_when_radius_differs():
    a = search_key("cozy ramen", 40.1234, -122.4198, 3000)
    b = search_key("cozy ramen", 40.1234, -122.4198, 5000)
    assert a != b


def test_places_key_uses_quantized_coords():
    a = places_key("indian", 40.1236, -122.4198, 3000)
    b = places_key("indian", 40.1238, -122.4201, 3000)
    # both quantize to 40.124 / -122.420
    assert a == b


def test_places_key_differs_for_different_cuisine():
    a = places_key("indian", 40.1234, -122.4198, 3000)
    b = places_key("thai", 40.1234, -122.4198, 3000)
    assert a != b
