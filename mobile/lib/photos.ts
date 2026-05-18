import { API_BASE } from './api';

export function photoUrl(name: string, width: number = 800): string {
  return `${API_BASE}/photo?name=${encodeURIComponent(name)}&w=${width}`;
}
