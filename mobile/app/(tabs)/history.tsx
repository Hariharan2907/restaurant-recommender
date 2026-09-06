import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon as Ionicons } from "@/components/Icon";
import { router, useFocusEffect } from "expo-router";
import { Button } from "@/components/Button";
import { ScreenLayout } from "@/components/ScreenLayout";
import { EmptyState, Notice, ResultsSkeleton } from "@/components/Feedback";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { colors, type } from "@/lib/theme";
import { deleteVisit, listVisits, type Visit } from "@/lib/visits";
const PAGE_SIZE = 20;
export default function HistoryScreen() {
  const { session, configured, loading } = useAuth();
  if (!session)
    return (
      <ScreenLayout
        scroll
        title="Your dining diary"
        subtitle="Memorable meals. Favorite dishes. A taste that’s entirely yours."
      >
        {loading ? (
          <ResultsSkeleton />
        ) : (
          <EmptyState
            icon="book-outline"
            title="Every great meal has a story."
            description={
              configured
                ? "Keep your visits, dishes, and little notes in one place. Each meal helps us get to know your taste."
                : "Your dining diary will be available when accounts are enabled. In the meantime, your next great meal is waiting."
            }
          >
            {configured && (
              <Button
                label="Sign in to start your diary"
                onPress={() => router.push("/auth/sign-in")}
              />
            )}
            <Button
              label="Explore restaurants"
              variant="secondary"
              onPress={() => router.navigate("/")}
            />
          </EmptyState>
        )}
      </ScreenLayout>
    );
  return <VisitsList />;
}
function VisitsList() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Visit | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async (offset = 0) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const page = await listVisits(PAGE_SIZE, offset);
      setTotal(page.total);
      setVisits((current) =>
        offset === 0
          ? page.visits
          : [
              ...current,
              ...page.visits.filter((v) => !current.some((c) => c.id === v.id)),
            ],
      );
      setError(null);
    } catch {
      setError("Your visits couldn’t be loaded. Please try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteVisit(deleting.id);
      setVisits((current) => current.filter((v) => v.id !== deleting.id));
      setTotal((n) => Math.max(0, n - 1));
      setDeleting(null);
    } catch {
      setDeleteError("We couldn’t remove this visit. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScreenLayout
      title="Your dining diary"
      subtitle="The places that shape your taste. A little better with every visit."
    >
      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {total} {total === 1 ? "meal" : "meals"} to remember
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={refresh}
          disabled={loading}
          style={styles.refresh}
        >
          <Ionicons name="refresh-outline" size={17} color={colors.accent} />
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      {error && <Notice error>{error}</Notice>}
      {loading && !visits.length ? (
        <ResultsSkeleton />
      ) : !visits.length && !error ? (
        <EmptyState
          icon="book-outline"
          title="Your first chapter awaits."
          description="After a great meal, open the restaurant and log your visit. Save a rating, a favorite dish, or a note for next time."
        >
          <Button
            label="Find your next table"
            onPress={() => router.navigate("/")}
          />
        </EmptyState>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v) => v.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <VisitCard
              visit={item}
              onDelete={() => {
                setDeleteError(null);
                setDeleting(item);
              }}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          onEndReached={() => {
            if (visits.length < total) void load(visits.length);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            visits.length < total ? (
              <Button
                label={loading ? "Loading more…" : "Load more visits"}
                loading={loading}
                variant="secondary"
                onPress={() => void load(visits.length)}
              />
            ) : null
          }
        />
      )}
      <ConfirmDialog
        visible={!!deleting}
        title="Remove this memory?"
        description={`This permanently removes your visit to ${deleting?.restaurant.name ?? "this restaurant"} from your diary and updates your taste profile.`}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        error={deleteError}
      />
    </ScreenLayout>
  );
}
function VisitCard({
  visit,
  onDelete,
}: {
  visit: Visit;
  onDelete: () => void;
}) {
  const date = new Date(visit.visited_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Ionicons name="restaurant-outline" size={24} color={colors.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={styles.name}>{visit.restaurant.name}</Text>
        <View style={styles.metaRow}>
          {visit.my_rating != null && (
            <Text
              accessibilityLabel={`Your rating: ${visit.my_rating} out of 5 stars`}
              style={styles.rating}
            >
              {"★".repeat(visit.my_rating)}
              <Text style={{ color: colors.hairline }}>
                {"★".repeat(5 - visit.my_rating)}
              </Text>
            </Text>
          )}
          {visit.mood && <Text style={styles.tag}>{visit.mood}</Text>}
          {visit.restaurant.cuisine && (
            <Text style={styles.meta}>{visit.restaurant.cuisine}</Text>
          )}
        </View>
        {!!visit.dishes_ordered.length && (
          <Text style={styles.meta}>
            On the table · {visit.dishes_ordered.join(" · ")}
          </Text>
        )}
        {visit.notes && <Text style={styles.notes}>{visit.notes}</Text>}
      </View>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete visit to ${visit.restaurant.name}`}
        style={styles.delete}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  count: { ...type.meta, color: colors.textMuted },
  refresh: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  link: { ...type.meta, color: colors.accent },
  list: { gap: 16, paddingBottom: 28 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 12,
  },
  cardIcon: {
    height: 44,
    width: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  cardBody: { flex: 1, gap: 8 },
  date: { ...type.label, letterSpacing: 1, color: colors.textMuted },
  name: { ...type.name, color: colors.text },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  rating: { fontSize: 17, color: colors.accent, letterSpacing: 2 },
  tag: {
    ...type.meta,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  meta: { ...type.meta, color: colors.textMuted, fontWeight: "400" },
  notes: { ...type.body, color: colors.textMuted, fontStyle: "italic" },
  delete: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
