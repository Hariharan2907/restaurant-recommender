import { useResponsiveDimensions } from "@/lib/useResponsiveDimensions";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon as Ionicons } from "@/components/Icon";
import { router } from "expo-router";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { FilterChips } from "@/components/FilterChips";
import { ResultsList } from "@/components/ResultsList";
import { Notice, ResultsSkeleton } from "@/components/Feedback";
import { Sheet } from "@/components/Sheet";
import { SearchFilters } from "@/components/SearchFilters";
import { capture } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { colors, serif, type } from "@/lib/theme";
import { getDeviceLocation, type Coords } from "@/lib/location";
import { discover, recommend } from "@/lib/recommendations";
import { search, type SearchResponse } from "@/lib/search";
import {
  buildQuery,
  distanceMeters,
  formatDistance,
  DEFAULT_REFINEMENTS,
  refinementCount,
  type SearchRefinements,
} from "@/lib/discovery";

type Mode = "search" | "forYou" | "discover";
const MODES = [
  {
    key: "search",
    label: "Explore nearby",
    short: "Explore",
    icon: "compass-outline",
  },
  {
    key: "forYou",
    label: "For your taste",
    short: "For you",
    icon: "sparkles-outline",
  },
  {
    key: "discover",
    label: "Something new",
    short: "Discover",
    icon: "shuffle-outline",
  },
] as const;
const AREAS = [
  { name: "Chicago", detail: "The Loop", lat: 41.8827, lng: -87.6233 },
  { name: "New York", detail: "Union Square", lat: 40.7359, lng: -73.9911 },
  {
    name: "San Francisco",
    detail: "Union Square",
    lat: 37.7879,
    lng: -122.4075,
  },
  { name: "Austin", detail: "Downtown", lat: 30.2672, lng: -97.7431 },
];
const IDEAS = [
  {
    title: "A little date-night magic",
    subtitle: "Low lights. Good food. Great company.",
    query: "cozy restaurant for date night",
    icon: "wine-outline",
    color: "#EDE5DE",
  },
  {
    title: "Comfort in every bite",
    subtitle: "Find your next favorite neighborhood spot.",
    query: "comfort food neighborhood restaurant",
    icon: "restaurant-outline",
    color: "#E8EBDF",
  },
  {
    title: "Fresh, bright & feel-good",
    subtitle: "Something delicious on the lighter side.",
    query: "healthy vegetarian lunch",
    icon: "leaf-outline",
    color: "#F1EBD9",
  },
] as const;

export default function SearchScreen() {
  const { session } = useAuth();
  const { width } = useResponsiveDimensions();
  const compact = width < 800;
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [filters, setFilters] =
    useState<SearchRefinements>(DEFAULT_REFINEMENTS);
  const [draft, setDraft] = useState<SearchRefinements>(DEFAULT_REFINEMENTS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [area, setArea] = useState("Choose an area");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef<TextInput>(null);
  const requestId = useRef(0);
  const locationRequestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current++;
      locationRequestId.current++;
    },
    [],
  );
  const filterCount = refinementCount(filters);
  const needsQuery = mode !== "discover";
  const effectiveQuery = buildQuery(query, filters);

  const invalidate = () => {
    requestId.current++;
    setLoading(false);
    setResponse(null);
    setError(null);
    setPersonalized(false);
  };
  const switchMode = (next: Mode) => {
    invalidate();
    setMode(next);
  };
  const locate = async () => {
    const id = ++locationRequestId.current;
    setLocating(true);
    setLocationError(null);
    const result = await getDeviceLocation();
    if (id !== locationRequestId.current) return;
    setLocating(false);
    if (result.kind === "ok") {
      invalidate();
      setCoords(result.coords);
      setArea("Near you");
      setLocationOpen(false);
    } else
      setLocationError(
        result.kind === "denied"
          ? "Location access is off. Enable it in your device settings, or choose an area below."
          : "We couldn’t find your location. Try again or choose an area below.",
      );
  };
  const onSearch = async () => {
    if (loading || (needsQuery && !effectiveQuery)) return;
    if (!coords) {
      setLocationOpen(true);
      return;
    }
    if (needsQuery && effectiveQuery.length > 200) {
      setError(
        "Keep your search and filters under 200 characters. Try a shorter description or fewer filters.",
      );
      return;
    }
    Keyboard.dismiss();
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    setResponse(null);
    capture("search_submitted", {
      mode,
      mood: filters.mood,
      dietary: filters.dietary,
    });
    try {
      let next: SearchResponse;
      let isPersonalized = false;
      if (mode === "search")
        next = await search(effectiveQuery, coords, filters.radius);
      else if (mode === "forYou") {
        const result = await recommend(
          effectiveQuery,
          coords,
          filters.mood ?? undefined,
          filters.radius === 3000 ? undefined : filters.radius,
        );
        next = result;
        isPersonalized = result.personalized;
      } else {
        const result = await discover(coords);
        next = {
          parsed_filters: {
            cuisine: null,
            min_rating: null,
            vibe_tags: [],
            dietary: [],
            price_max: null,
            intent: null,
          },
          results: result.results,
          cached: false,
        };
        isPersonalized = result.personalized;
      }
      if (id !== requestId.current) return;
      setResponse({
        ...next,
        results: next.results.map((result) => ({
          ...result,
          distance_m: result.distance_m ?? distanceMeters(coords, result),
        })),
      });
      setPersonalized(isPersonalized);
      setSubmitted(query.trim() || "Your preferences");
    } catch {
      if (id === requestId.current)
        setError(
          "We couldn’t load restaurants right now. Your search is still here — please try again in a moment.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };
  const openFilters = () => {
    setDraft(filters);
    setFilterOpen(true);
  };
  const useIdea = (idea: string) => {
    invalidate();
    setMode("search");
    setQuery(idea);
    inputRef.current?.focus();
  };

  return (
    <ScreenLayout wide scroll>
      <View style={styles.topline}>
        <Text style={styles.eyebrow}>GOOD FOOD. YOUR KIND OF PLACE.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Location: ${area}. Change area`}
          onPress={() => setLocationOpen(true)}
          style={styles.location}
        >
          <Ionicons name="location-outline" size={16} color={colors.accent} />
          <Text style={styles.locationText} numberOfLines={1}>
            {area}
          </Text>
          <Ionicons name="chevron-down" size={13} color={colors.accent} />
        </Pressable>
      </View>
      {!loading && !response && !error && (
        <View
          style={[
            styles.hero,
            compact && { gap: 12, paddingTop: 8, paddingBottom: 16 },
          ]}
        >
          <View style={styles.heroCopy}>
            <Text
              accessibilityRole="header"
              style={[
                styles.heroTitle,
                compact && { fontSize: 32, lineHeight: 38 },
              ]}
            >
              Good taste deserves{!compact ? "\n" : " "}a great table.
            </Text>
            <Text style={styles.heroSubtitle}>
              From your everyday favorite to your next great find. Discover
              restaurants that feel like you.
            </Text>
            {!compact && (
              <View style={styles.heroNote}>
                <View style={styles.smallIcon}>
                  <Ionicons
                    name="restaurant-outline"
                    size={17}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.heroNoteText}>
                  Less searching. More savoring.
                </Text>
              </View>
            )}
          </View>
          {!compact && (
            <View style={styles.heroImageWrap}>
              <Image
                source={require("../../assets/dining-editorial.jpg")}
                style={styles.heroImage}
                accessibilityLabel="Editorial food inspiration: pasta, burrata, and fresh tomatoes on a bistro table"
              />
              <View style={styles.imageCaption}>
                <Text style={styles.imageCaptionText}>
                  THE JOY OF FINDING YOUR NEXT FAVORITE
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
      <View
        style={[
          styles.searchPanel,
          (loading || response || error) && { marginTop: 16 },
        ]}
      >
        <View style={[styles.modes, compact && styles.modesCompact]}>
          {MODES.map((m) => (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m.key }}
              aria-pressed={mode === m.key}
              onPress={() => switchMode(m.key)}
              style={[
                styles.mode,
                compact && styles.modeCompact,
                mode === m.key && styles.modeActive,
              ]}
            >
              <Ionicons
                name={m.icon}
                size={17}
                color={mode === m.key ? colors.accent : colors.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.modeText,
                  mode === m.key && { color: colors.accent },
                ]}
              >
                {compact ? m.short : m.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {mode === "discover" ? (
          <View style={styles.discoverIntro}>
            <Text style={styles.sectionTitle}>
              Your next favorite is out there.
            </Text>
            <Text style={styles.subtitle}>
              Find new places with something in common with the ones you’ve
              loved.
            </Text>
            {session ? (
              <Button
                label={loading ? "Finding new favorites…" : "Surprise me"}
                loading={loading}
                onPress={onSearch}
              />
            ) : (
              <Button
                label="Sign in to discover"
                onPress={() => router.push("/auth/sign-in")}
              />
            )}
          </View>
        ) : (
          <>
            <Text style={styles.searchLabel}>WHAT SOUNDS GOOD?</Text>
            <View style={[styles.searchRow, compact && { flexWrap: "wrap" }]}>
              <Ionicons name="search-outline" size={22} color={colors.accent} />
              <TextInput
                ref={inputRef}
                accessibilityLabel="What sounds good? Describe your ideal meal"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={onSearch}
                placeholder={
                  compact
                    ? "Your next great meal…"
                    : "Quiet Italian dinner under $40…"
                }
                placeholderTextColor={colors.textFaint}
                maxLength={200}
                style={styles.input}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => {
                    setQuery("");
                    invalidate();
                    inputRef.current?.focus();
                  }}
                  style={styles.clear}
                >
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              <View
                style={
                  compact ? { flexBasis: "100%", marginTop: 6 } : undefined
                }
              >
                <Button
                  label={loading ? "Finding your table…" : "Find my table"}
                  loading={loading}
                  disabled={!effectiveQuery}
                  onPress={onSearch}
                />
              </View>
            </View>
            <View style={styles.examples}>
              <Text style={styles.tryText}>Try</Text>
              {[
                "quiet Italian dinner under $40",
                "the best ramen nearby",
                "a cozy brunch spot",
              ]
                .slice(0, compact ? 2 : 3)
                .map((example) => (
                  <Pressable
                    key={example}
                    onPress={() => useIdea(example)}
                    accessibilityRole="button"
                    style={styles.example}
                  >
                    <Text style={styles.exampleText}>{example}</Text>
                    <Ionicons
                      name="arrow-up-outline"
                      size={12}
                      color={colors.textMuted}
                      style={{ transform: [{ rotate: "45deg" }] }}
                    />
                  </Pressable>
                ))}
            </View>
            {mode === "forYou" && (
              <Text style={styles.personalizationNote}>
                {session
                  ? "Your visits and taste preferences help shape these recommendations."
                  : "Start with what you love. Sign in to personalize picks with your visit history."}
              </Text>
            )}
          </>
        )}
      </View>
      {needsQuery && (
        <View style={styles.filterBar}>
          <View style={styles.filterChips}>
            <Chip
              label={filters.cuisine || "Cuisine"}
              selected={!!filters.cuisine}
              onPress={openFilters}
            />
            <Chip
              label={
                filters.price ? "$".repeat(filters.price) + " & under" : "Price"
              }
              selected={!!filters.price}
              onPress={openFilters}
            />
            <Chip
              label={
                filters.dietary.length
                  ? `Dietary · ${filters.dietary.length}`
                  : "Dietary"
              }
              selected={!!filters.dietary.length}
              onPress={openFilters}
            />
            {!compact && (
              <>
                <Chip
                  label={filters.rating ? `${filters.rating}+ stars` : "Rating"}
                  selected={!!filters.rating}
                  onPress={openFilters}
                />
                <Chip
                  label={formatDistance(filters.radius)}
                  selected={filters.radius !== 3000}
                  onPress={openFilters}
                />
              </>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open all filters"
              onPress={openFilters}
              style={styles.allFilters}
            >
              <Ionicons name="options-outline" size={17} color={colors.text} />
              <Text style={styles.modeText}>
                Filters{filterCount ? ` · ${filterCount}` : ""}
              </Text>
            </Pressable>
          </View>
          {!!filterCount && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFilters(DEFAULT_REFINEMENTS);
                invalidate();
              }}
              style={styles.clearFilters}
            >
              <Text style={styles.link}>Reset filters</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.results}>
        {error && <Notice error>{error}</Notice>}
        {loading ? (
          <>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              aria-level={1}
              style={styles.sectionTitle}
            >
              Finding your kind of place…
            </Text>
            <ResultsSkeleton />
          </>
        ) : response ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.eyebrow}>
                  {personalized
                    ? "SELECTED FOR YOUR TASTE"
                    : "YOUR RESTAURANT SHORTLIST"}
                </Text>
                <Text
                  accessibilityRole="header"
                  aria-level={1}
                  style={styles.sectionTitle}
                >
                  {mode === "discover"
                    ? "A fresh discovery"
                    : "A table worth finding"}
                </Text>
                <Text style={styles.subtitle}>
                  {response.results.length}{" "}
                  {response.results.length === 1 ? "place" : "places"}
                  {mode !== "discover" ? ` for “${submitted}”` : ""} · {area}
                </Text>
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/profile")}
                style={styles.clearFilters}
              >
                <Text style={styles.link}>Edit your taste →</Text>
              </Pressable>
            </View>
            <FilterChips filters={response.parsed_filters} />
            {!!response.parsed_filters.dietary.length && (
              <Notice>
                Dietary requests guide this search. Please confirm ingredients
                and preparation with the restaurant.
              </Notice>
            )}
            <ResultsList results={response.results} onReset={openFilters} />
            {!!response.results.length && (
              <Text style={styles.source}>
                Restaurant information from Google Places. Ratings and
                availability may change.
              </Text>
            )}
          </>
        ) : (
          !error && (
            <>
              <View style={styles.sectionHeader}>
                <View style={{ gap: 5 }}>
                  <Text style={styles.eyebrow}>FOLLOW YOUR APPETITE</Text>
                  <Text
                    accessibilityRole="header"
                    aria-level={2}
                    style={styles.sectionTitle}
                  >
                    A good place to start
                  </Text>
                </View>
                <Text style={styles.subtitle}>What’s the occasion?</Text>
              </View>
              <View
                style={[styles.ideas, compact && { flexDirection: "column" }]}
              >
                {IDEAS.map((idea) => (
                  <Pressable
                    key={idea.title}
                    accessibilityRole="button"
                    accessibilityLabel={`Search for ${idea.query}`}
                    onPress={() => useIdea(idea.query)}
                    style={({ pressed }) => [
                      styles.idea,
                      { backgroundColor: idea.color },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={styles.ideaTop}>
                      <Ionicons
                        name={idea.icon}
                        size={26}
                        color={colors.accent}
                      />
                      <Ionicons
                        name="arrow-forward"
                        size={19}
                        color={colors.accent}
                      />
                    </View>
                    <Text style={styles.ideaTitle}>{idea.title}</Text>
                    <Text style={styles.ideaSubtitle}>{idea.subtitle}</Text>
                  </Pressable>
                ))}
              </View>
              <View
                style={[
                  styles.tasteBanner,
                  compact && {
                    alignItems: "flex-start",
                    flexDirection: "column",
                  },
                ]}
              >
                <View style={styles.bannerCopy}>
                  <Ionicons
                    name="finger-print-outline"
                    size={30}
                    color={colors.accent}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.bannerTitle}>
                      Good recommendations start with you.
                    </Text>
                    <Text style={styles.subtitle}>
                      A few preferences. Your favorite places. A taste profile
                      that keeps getting better.
                    </Text>
                  </View>
                </View>
                <Button
                  label="Shape your taste →"
                  variant="secondary"
                  onPress={() => router.push("/profile")}
                />
              </View>
            </>
          )
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>fork.</Text>
        <Text style={styles.footerText}>
          A little more you. A lot more delicious.
        </Text>
      </View>
      <Sheet
        visible={filterOpen}
        title="Make it your kind of meal"
        onClose={() => setFilterOpen(false)}
        footer={
          <>
            <Button
              label="Apply preferences"
              onPress={() => {
                setFilters(draft);
                invalidate();
                setFilterOpen(false);
              }}
            />
            <Button
              label="Reset all"
              variant="secondary"
              onPress={() => setDraft(DEFAULT_REFINEMENTS)}
            />
          </>
        }
      >
        <SearchFilters value={draft} onChange={setDraft} />
      </Sheet>
      <Sheet
        visible={locationOpen}
        title="Where are we eating?"
        onClose={() => setLocationOpen(false)}
      >
        <Text style={styles.subtitle}>
          Use your location or explore around a city center.
        </Text>
        <Button
          label={
            locating ? "Finding your location…" : "Use my current location"
          }
          loading={locating}
          onPress={locate}
        />
        {locationError && <Notice error>{locationError}</Notice>}
        <Text style={styles.eyebrow}>EXPLORE AN AREA</Text>
        {AREAS.map((a) => (
          <Pressable
            key={a.name}
            accessibilityRole="button"
            onPress={() => {
              invalidate();
              locationRequestId.current++;
              setLocating(false);
              setCoords({ lat: a.lat, lng: a.lng });
              setArea(`${a.name} · ${a.detail}`);
              setLocationOpen(false);
            }}
            style={styles.areaRow}
          >
            <Ionicons name="location-outline" size={21} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.areaName}>{a.name}</Text>
              <Text style={styles.subtitle}>{a.detail} · city center</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.accent} />
          </Pressable>
        ))}
      </Sheet>
    </ScreenLayout>
  );
}
const styles = StyleSheet.create({
  topline: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  eyebrow: { ...type.label, color: colors.accent },
  location: {
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    flexShrink: 1,
    maxWidth: "100%",
  },
  locationText: { ...type.meta, color: colors.accent, flexShrink: 1 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 50,
    paddingTop: 24,
    paddingBottom: 34,
    width: "100%",
  },
  heroCopy: { flex: 1, gap: 18, minWidth: 0 },
  heroTitle: {
    fontFamily: serif,
    fontSize: 48,
    lineHeight: 55,
    letterSpacing: -1.7,
    color: colors.text,
    maxWidth: "100%",
  },
  heroSubtitle: { ...type.body, color: colors.textMuted, maxWidth: 400 },
  heroNote: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallIcon: {
    backgroundColor: colors.accentSoft,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  heroNoteText: { ...type.meta, color: colors.accent },
  heroImageWrap: {
    width: "40%",
    height: 252,
    borderRadius: 20,
    borderTopLeftRadius: 80,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  heroImage: { width: "100%", height: "100%" },
  imageCaption: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: colors.bg,
    padding: 10,
    borderRadius: 5,
  },
  imageCaptionText: {
    ...type.label,
    letterSpacing: 1.2,
    textAlign: "center",
    color: colors.accent,
  },
  searchPanel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    boxShadow: "0 6px 24px rgba(40,45,37,0.035)",
  },
  modes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingBottom: 12,
    marginBottom: 20,
    width: "100%",
  },
  mode: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modesCompact: { gap: 6 },
  modeCompact: {
    flexGrow: 1,
    flexBasis: "28%",
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  modeActive: { backgroundColor: colors.accentSoft },
  modeText: { ...type.meta, color: colors.textMuted },
  searchLabel: {
    ...type.label,
    color: colors.textMuted,
    marginBottom: 8,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    ...type.input,
    minHeight: 50,
    flex: 1,
    minWidth: 100,
    color: colors.text,
    paddingHorizontal: 4,
  },
  clear: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  examples: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  tryText: { fontSize: 13, color: colors.textMuted },
  example: {
    minHeight: 44,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
  },
  exampleText: { fontSize: 13, color: colors.textMuted },
  personalizationNote: { ...type.meta, color: colors.accent, marginTop: 12 },
  discoverIntro: { gap: 12 },
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
  },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  allFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
  },
  clearFilters: { justifyContent: "center", minHeight: 44 },
  link: { ...type.meta, color: colors.accent, textDecorationLine: "underline" },
  results: { gap: 20, marginTop: 36 },
  sectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sectionTitle: { ...type.heading, color: colors.text },
  subtitle: { ...type.meta, fontWeight: "400", color: colors.textMuted },
  ideas: { flexDirection: "row", gap: 16 },
  idea: { flex: 1, padding: 22, borderRadius: 16, gap: 10 },
  ideaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ideaTitle: {
    fontFamily: serif,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  ideaSubtitle: {
    ...type.meta,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "400",
  },
  tasteBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    paddingVertical: 28,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    marginTop: 12,
  },
  bannerCopy: { flex: 1, flexDirection: "row", gap: 16, alignItems: "center" },
  bannerTitle: { ...type.name, fontSize: 16, color: colors.text },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    marginTop: 10,
    paddingTop: 20,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerBrand: {
    fontFamily: serif,
    fontSize: 24,
    color: colors.accent,
    fontWeight: "700",
  },
  footerText: { fontSize: 11, color: colors.textMuted },
  source: { ...type.meta, fontSize: 11, color: colors.textMuted },
  areaRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  areaName: { ...type.name, color: colors.text },
});
