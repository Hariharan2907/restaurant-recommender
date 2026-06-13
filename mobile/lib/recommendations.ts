import { apiFetch, apiJson } from '@/lib/api';
import type { Coords } from '@/lib/location';
import type { ParsedFilters, RestaurantResult } from '@/lib/search';

export type RecommendationResult = RestaurantResult & {
  popular_dishes: string[];
};

export type RecommendationsResponse = {
  parsed_filters: ParsedFilters;
  results: RecommendationResult[];
  personalized: boolean;
  cached: boolean;
};

export function recommend(
  query: string,
  loc: Coords,
  mood?: string,
): Promise<RecommendationsResponse> {
  return apiJson('/recommendations', 'POST', {
    query,
    lat: loc.lat,
    lng: loc.lng,
    ...(mood ? { mood } : {}),
  });
}

export type Dish = {
  dish_name: string;
  mention_count: number;
  sentiment: number | null;
  sample_quote: string | null;
};

export type DishesResponse = {
  google_place_id: string;
  dishes: Dish[];
  attribution: string;
};

export function getDishes(placeId: string): Promise<DishesResponse> {
  return apiFetch(`/restaurants/${encodeURIComponent(placeId)}/dishes`);
}

export type DiscoverResponse = {
  results: RecommendationResult[];
  personalized: boolean;
};

export function discover(loc: Coords): Promise<DiscoverResponse> {
  return apiFetch(`/discover?lat=${loc.lat}&lng=${loc.lng}`);
}
