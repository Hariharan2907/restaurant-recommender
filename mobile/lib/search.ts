import { API_BASE } from './api';
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
  price_tier: number | null;
  lat: number;
  lng: number;
  address: string | null;
  photo_url: string | null;
  distance_m: number | null;
};

export type SearchResponse = {
  parsed_filters: ParsedFilters;
  results: RestaurantResult[];
  cached: boolean;
};

export async function search(query: string, loc: Coords): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, lat: loc.lat, lng: loc.lng }),
  });
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  return res.json();
}
