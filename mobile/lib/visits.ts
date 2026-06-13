import { apiFetch, apiJson } from '@/lib/api';

export type VisitRestaurant = {
  google_place_id: string;
  name: string;
  cuisine: string | null;
};

export type Visit = {
  id: string;
  restaurant: VisitRestaurant;
  mood: string | null;
  dishes_ordered: string[];
  my_rating: number | null;
  notes: string | null;
  visited_at: string;
};

export type VisitList = {
  visits: Visit[];
  total: number;
  limit: number;
  offset: number;
};

export type VisitCreate = {
  google_place_id: string;
  restaurant_name?: string;
  lat?: number;
  lng?: number;
  cuisine?: string;
  mood?: string;
  dishes_ordered?: string[];
  my_rating?: number;
  notes?: string;
};

export function listVisits(limit = 20, offset = 0): Promise<VisitList> {
  return apiFetch(`/visits?limit=${limit}&offset=${offset}`);
}

export function createVisit(payload: VisitCreate): Promise<Visit> {
  return apiJson('/visits', 'POST', payload);
}

export function deleteVisit(id: string): Promise<null> {
  return apiJson(`/visits/${id}`, 'DELETE');
}
