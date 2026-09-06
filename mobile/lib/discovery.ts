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
  const miles = meters / 1609.344;
  return miles > 0 && miles < 0.1 ? "<0.1 mi" : `${miles.toFixed(1)} mi`;
}

/** Straight-line distance for display only; never changes backend ranking. */
export function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number | null {
  if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) return null;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(radians(to.lat - from.lat) / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(radians(to.lng - from.lng) / 2) ** 2;
  return Math.round(
    6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))),
  );
}

export function restaurantSummary(item: {
  rating: number | null;
  user_ratings_total: number | null;
  cuisine: string | null;
  price_tier: number | null;
}): string {
  if (item.rating != null)
    return `Rated ${item.rating.toFixed(1)} out of 5${item.user_ratings_total != null ? ` from ${item.user_ratings_total.toLocaleString()} diner reviews` : " by diners"}.`;
  if (item.cuisine)
    return `A ${item.cuisine} option from your restaurant search. Explore the details before you choose.`;
  return "Explore the restaurant details and current listing to decide if it’s right for you.";
}
