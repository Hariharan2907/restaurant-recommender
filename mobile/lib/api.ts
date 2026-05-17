export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}
