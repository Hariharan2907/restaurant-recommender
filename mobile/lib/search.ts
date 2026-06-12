import { apiJson } from './api';
import type { Coords } from './location';

export type ParsedFilters = {
  cuisine: string | null;
  min_rating: number | null;
  vibe_tags: string[];
  dietary: string[];
  price_max: number | null;
  intent: string | null;
};

export type RestaurantResult = {
  google_place_id: string;
  name: string;
  cuisine: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  price_tier: number | null;
  lat: number;
  lng: number;
  address: string | null;
  photo_refs: string[];
  distance_m: number | null;
  explanation: string | null;
  /** Present on /recommendations and /discover results. */
  popular_dishes?: string[];
};

export type SearchResponse = {
  parsed_filters: ParsedFilters;
  results: RestaurantResult[];
  cached: boolean;
};

export async function search(query: string, loc: Coords): Promise<SearchResponse> {
  // apiJson attaches the Supabase bearer token when signed in, which lets the
  // backend reorder results against the user's taste profile.
  return apiJson('/search', 'POST', { query, lat: loc.lat, lng: loc.lng });
}
