export type SearchRefinements = {
  cuisine: string | null;
  price: number | null;
  rating: number | null;
  radius: number;
  dietary: string[];
  mood: string | null;
};
export const DEFAULT_REFINEMENTS: SearchRefinements = {
  cuisine: null,
  price: null,
  rating: null,
  radius: 3000,
  dietary: [],
  mood: null,
};
export function buildQuery(query: string, filters: SearchRefinements): string {
  return [
    query.trim(),
    filters.cuisine,
    filters.price ? `price at most ${"$".repeat(filters.price)}` : null,
    filters.rating ? `rated at least ${filters.rating} stars` : null,
    ...filters.dietary.map((d) => d.replace(/_/g, " ")),
    filters.mood,
  ]
    .filter(Boolean)
    .join(", ");
}
export function refinementCount(filters: SearchRefinements): number {
  return (
    Number(!!filters.cuisine) +
    Number(!!filters.price) +
    Number(!!filters.rating) +
    Number(filters.radius !== 3000) +
    filters.dietary.length +
    Number(!!filters.mood)
  );
}
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}
