import { apiFetch, apiJson } from '@/lib/api';

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  dietary_preferences: string[];
  default_radius_m: number;
  cuisine_likes: string[];
  cuisine_dislikes: string[];
  created_at: string;
  visits_count: number;
  taste_profile_trained: boolean;
};

export type ProfileUpdate = Partial<{
  display_name: string;
  dietary_preferences: string[];
  default_radius_m: number;
  cuisine_likes: string[];
  cuisine_dislikes: string[];
}>;

export function getMe(): Promise<UserProfile> {
  return apiFetch('/me');
}

export function updateMe(patch: ProfileUpdate): Promise<UserProfile> {
  return apiJson('/me', 'PATCH', patch);
}

export function deleteAccount(): Promise<null> {
  return apiJson('/me', 'DELETE');
}
