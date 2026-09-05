import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { ScreenLayout } from "@/components/ScreenLayout";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { Notice } from "@/components/Feedback";
import { useAuth } from "@/lib/auth";
import { getDishes, type Dish } from "@/lib/recommendations";
import { colors, type } from "@/lib/theme";
import { formatDistance } from "@/lib/discovery";

type ParamShape = {
  placeId: string;
  name: string;
  rating: string;
  userRatingsTotal: string;
  priceTier: string;
  cuisine: string;
  address: string;
  lat: string;
  lng: string;
  photoRefs: string;
  explanation: string;
  distance: string;
};
export default function RestaurantDetail() {
  const params = useLocalSearchParams<ParamShape>();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 800;
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishState, setDishState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [linkError, setLinkError] = useState(false);
  const name = params.name || "Restaurant details";
  const rating = params.rating ? Number(params.rating) : null;
  const ratingsCount = params.userRatingsTotal
    ? Number(params.userRatingsTotal)
    : null;
  const priceTier = params.priceTier ? Number(params.priceTier) : null;
  const photoRefs = useMemo<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(params.photoRefs || "[]");
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }, [params.photoRefs]);
  useEffect(() => {
    let cancelled = false;
    setDishState("loading");
    setDishes([]);
    setPhotoIndex(0);
    getDishes(params.placeId)
      .then((r) => {
        if (!cancelled) {
          setDishes(r.dishes);
          setDishState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setDishState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [params.placeId]);
  const onLogVisit = () => {
    if (!session) {
      router.push("/auth/sign-in");
      return;
    }
    router.push({
      pathname: "/log-visit",
      params: {
        placeId: params.placeId,
        name,
        lat: params.lat ?? "",
        lng: params.lng ?? "",
        cuisine: params.cuisine ?? "",
      },
    });
  };
  const openInMaps = async () => {
    setLinkError(false);
    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(params.name || params.placeId)}&query_place_id=${encodeURIComponent(params.placeId)}`,
      );
    } catch {
      setLinkError(true);
    }
  };
  return (
    <ScreenLayout wide scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to restaurants"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        style={styles.back}
      >
        <Ionicons name="arrow-back" size={19} color={colors.accent} />
        <Text style={styles.link}>Back to discovering</Text>
      </Pressable>
      <View style={styles.hero}>
        <RestaurantPhoto
          photoRef={photoRefs[photoIndex]}
          name={name}
          height={compact ? 250 : 380}
          width={1200}
        />
        {photoRefs.length > 1 && (
          <View style={styles.photoControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              onPress={() =>
                setPhotoIndex(
                  (i) => (i - 1 + photoRefs.length) % photoRefs.length,
                )
              }
              style={styles.photoButton}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={styles.photoCount}>
              {photoIndex + 1} / {photoRefs.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              onPress={() => setPhotoIndex((i) => (i + 1) % photoRefs.length)}
              style={styles.photoButton}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>
      <View style={[styles.columns, compact && { flexDirection: "column" }]}>
        <View style={styles.main}>
          <Text style={styles.eyebrow}>
            {params.cuisine || "YOUR NEXT TABLE"}
          </Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            {rating != null && Number.isFinite(rating) && (
              <>
                <Ionicons name="star" size={15} color={colors.accent} />
                <Text style={styles.meta}>
                  {rating.toFixed(1)}
                  {ratingsCount != null && Number.isFinite(ratingsCount)
                    ? ` (${ratingsCount.toLocaleString()} reviews)`
                    : ""}
                </Text>
              </>
            )}
            {priceTier != null && Number.isFinite(priceTier) && (
              <Text style={styles.meta}>
                {"$".repeat(Math.max(0, Math.min(4, priceTier))) || "Free"}
              </Text>
            )}
            {params.distance && (
              <Text style={styles.meta}>
                {formatDistance(Number(params.distance))} away
              </Text>
            )}
          </View>
          {params.address && (
            <Text style={styles.address}>{params.address}</Text>
          )}
          {params.explanation && (
            <View style={styles.reason}>
              <View style={styles.metaRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={19}
                  color={colors.accent}
                />
                <Text style={styles.eyebrow}>WHY THIS MATCHES</Text>
              </View>
              <Text style={styles.reasonText}>{params.explanation}</Text>
            </View>
          )}
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              The dishes people talk about
            </Text>
            <Text style={styles.body}>
              A little inspiration for your order, drawn from diner reviews.
            </Text>
            {dishState === "loading" ? (
              <Text
                accessibilityRole="progressbar"
                accessibilityLabel="Loading popular dishes"
                style={styles.body}
              >
                Looking up popular dishes…
              </Text>
            ) : dishes.length ? (
              dishes.slice(0, 6).map((dish, index) => (
                <View key={dish.dish_name} style={styles.dishRow}>
                  <Text style={styles.dishNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <Text style={styles.dishName}>{dish.dish_name}</Text>
                  <Text style={styles.dishMeta}>
                    {dish.mention_count}{" "}
                    {dish.mention_count === 1 ? "mention" : "mentions"}
                  </Text>
                </View>
              ))
            ) : (
              <Notice>
                {dishState === "error"
                  ? "Popular dishes couldn’t be loaded right now. You can still explore this restaurant in Google Maps."
                  : "No popular dishes have been collected yet. Check the restaurant’s current menu before you go."}
              </Notice>
            )}
            {!!dishes.length && (
              <Text style={styles.attribution}>
                Dish data derived from Google and Yelp reviews.
              </Text>
            )}
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Before you go
            </Text>
            <Text style={styles.body}>
              For current hours, menus, contact information, and availability,
              visit the restaurant’s Google Maps listing.
            </Text>
            <Text style={styles.body}>
              Have a dietary need? Confirm ingredients and preparation directly
              with the restaurant.
            </Text>
          </View>
        </View>
        <View style={[styles.sidebar, !compact && { width: 320 }]}>
          <View style={styles.visitCard}>
            <View style={styles.metaRow}>
              <Ionicons
                name="location-outline"
                size={22}
                color={colors.accent}
              />
              <Text style={styles.cardTitle}>Make a meal of it.</Text>
            </View>
            <Text style={styles.body}>
              {params.address ||
                "Find this restaurant and plan your visit in Google Maps."}
            </Text>
            <Button label="Get directions ↗" onPress={openInMaps} />
            <Button
              label="Log a visit"
              variant="secondary"
              onPress={onLogVisit}
            />
            <Text style={styles.helper}>
              Been here? Your rating helps us find more places you’ll love.
            </Text>
            {linkError && (
              <Notice error>We couldn’t open Maps. Please try again.</Notice>
            )}
          </View>
          <View style={styles.more}>
            <Ionicons name="compass-outline" size={24} color={colors.accent} />
            <Text style={styles.cardTitle}>There’s more to discover.</Text>
            <Text style={styles.body}>
              Keep exploring to find the right table for tonight.
            </Text>
            <Button
              label="Explore more restaurants"
              variant="secondary"
              onPress={() => router.navigate("/")}
            />
          </View>
        </View>
      </View>
    </ScreenLayout>
  );
}
const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 44,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  link: { ...type.meta, color: colors.accent },
  hero: { borderRadius: 22, overflow: "hidden" },
  photoControls: {
    position: "absolute",
    bottom: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 30,
    padding: 4,
  },
  photoButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  photoCount: { ...type.meta, color: colors.text },
  columns: { flexDirection: "row", gap: 40, marginTop: 32 },
  main: { flex: 1, gap: 14, minWidth: 0 },
  eyebrow: { ...type.label, color: colors.accent },
  name: { ...type.display, color: colors.text },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  meta: { ...type.meta, color: colors.text },
  address: { ...type.body, color: colors.textMuted },
  reason: {
    backgroundColor: colors.accentSoft,
    padding: 24,
    borderRadius: 16,
    gap: 12,
    marginTop: 12,
  },
  reasonText: { ...type.body, color: colors.accent },
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 24,
    marginTop: 16,
    gap: 12,
  },
  sectionTitle: { ...type.heading, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
  dishRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 12,
  },
  dishNumber: { ...type.meta, color: colors.accent },
  dishName: { ...type.body, flex: 1, minWidth: 100, color: colors.text },
  dishMeta: { ...type.meta, color: colors.textMuted, fontSize: 11 },
  attribution: { ...type.meta, color: colors.textMuted, fontSize: 11 },
  sidebar: { gap: 24 },
  visitCard: {
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
  },
  cardTitle: { ...type.name, color: colors.text },
  helper: { ...type.meta, fontWeight: "400", color: colors.textMuted },
  more: {
    gap: 14,
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 18,
  },
});
