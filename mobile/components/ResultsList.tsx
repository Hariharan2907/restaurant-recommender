import { useResponsiveDimensions } from "@/lib/useResponsiveDimensions";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon as Ionicons } from "@/components/Icon";
import { router } from "expo-router";
import { colors, type } from "@/lib/theme";
import { RestaurantPhoto } from "./RestaurantPhoto";
import { EmptyState } from "./Feedback";
import type { RestaurantResult } from "@/lib/search";
import { formatDistance, restaurantSummary } from "@/lib/discovery";

export function ResultsList({
  results,
  onReset,
}: {
  results: RestaurantResult[];
  onReset?: () => void;
}) {
  const { width } = useResponsiveDimensions();
  const columns = width >= 1050 ? 3 : width >= 650 ? 2 : 1;
  if (!results.length)
    return (
      <EmptyState
        icon="search-outline"
        title="A little too specific?"
        description="We couldn’t find a match this time. Try another cuisine, a wider area, or fewer filters."
      >
        {onReset && (
          <Pressable
            accessibilityRole="button"
            onPress={onReset}
            style={styles.emptyAction}
          >
            <Text style={{ ...type.button, color: colors.accent }}>
              Refine your search →
            </Text>
          </Pressable>
        )}
      </EmptyState>
    );
  return (
    <View style={styles.list}>
      {results.map((item, index) => (
        <View
          key={item.google_place_id}
          style={{
            width: columns === 3 ? "31.9%" : columns === 2 ? "48.7%" : "100%",
          }}
        >
          <Card item={item} index={index} />
        </View>
      ))}
    </View>
  );
}
function openDetail(item: RestaurantResult) {
  router.push({
    pathname: "/restaurant/[placeId]",
    params: {
      placeId: item.google_place_id,
      name: item.name,
      rating: item.rating ?? "",
      userRatingsTotal: item.user_ratings_total ?? "",
      priceTier: item.price_tier ?? "",
      cuisine: item.cuisine ?? "",
      address: item.address ?? "",
      lat: item.lat,
      lng: item.lng,
      photoRefs: JSON.stringify(item.photo_refs ?? []),
      explanation: item.explanation ?? "",
      distance: item.distance_m ?? "",
    },
  });
}
function Card({ item, index }: { item: RestaurantResult; index: number }) {
  return (
    <Pressable
      onPress={() => openDetail(item)}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}, ${item.cuisine || "restaurant"}${item.rating != null ? `, rated ${item.rating} stars` : ""}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View>
        <RestaurantPhoto photoRef={item.photo_refs?.[0]} name={item.name} />
        <View style={styles.rank}>
          <Text style={styles.rankText}>
            {String(index + 1).padStart(2, "0")} / YOUR SHORTLIST
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{item.name}</Text>
          <Ionicons name="arrow-forward" size={19} color={colors.accent} />
        </View>
        <View style={styles.metaRow}>
          {item.cuisine && <Text style={styles.meta}>{item.cuisine}</Text>}
          {item.price_tier != null && (
            <Text style={styles.meta}>
              {item.price_tier === 0 ? "Free" : "$".repeat(item.price_tier)}
            </Text>
          )}
          {item.distance_m != null && (
            <Text style={styles.meta}>
              {formatDistance(item.distance_m)} away
            </Text>
          )}
        </View>
        {item.rating != null && (
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color={colors.accent} />
            <Text style={styles.rating}>
              {item.rating.toFixed(1)}{" "}
              <Text style={styles.reviewCount}>
                {item.user_ratings_total != null
                  ? `(${item.user_ratings_total.toLocaleString()} reviews)`
                  : ""}
              </Text>
            </Text>
          </View>
        )}
        {item.address && (
          <Text numberOfLines={2} style={styles.address}>
            {item.address}
          </Text>
        )}
        {!!item.popular_dishes?.length && (
          <Text style={styles.meta}>
            Try {item.popular_dishes.slice(0, 2).join(" or ")}
          </Text>
        )}
        {
          <View style={styles.reasonBox}>
            <View style={styles.metaRow}>
              <Ionicons
                name="sparkles-outline"
                size={14}
                color={colors.accent}
              />
              <Text style={styles.reasonLabel}>
                {item.explanation ? "WHY THIS MATCHES" : "WHY CONSIDER IT"}
              </Text>
            </View>
            <Text style={styles.reason}>
              {item.explanation || restaurantSummary(item)}
            </Text>
          </View>
        }
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
    width: "100%",
  },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  rank: {
    position: "absolute",
    left: 14,
    top: 14,
    backgroundColor: colors.bg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rankText: {
    ...type.label,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.accent,
  },
  body: { padding: 20, gap: 10, flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { ...type.name, color: colors.text, flex: 1 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  meta: { ...type.meta, color: colors.textMuted, textTransform: "capitalize" },
  rating: { ...type.meta, color: colors.text, fontWeight: "700" },
  reviewCount: { fontWeight: "400", color: colors.textMuted },
  address: { ...type.meta, fontWeight: "400", color: colors.textMuted },
  reasonBox: {
    marginTop: 4,
    backgroundColor: colors.accentSoft,
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  reasonLabel: {
    ...type.label,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.accent,
  },
  reason: { ...type.meta, fontWeight: "400", color: colors.accent },
  emptyAction: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
