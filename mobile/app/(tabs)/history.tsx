import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '@/components/Button';
import { ScreenLayout } from '@/components/ScreenLayout';
import { useAuth } from '@/lib/auth';
import { colors, space, type } from '@/lib/theme';
import { deleteVisit, listVisits, type Visit } from '@/lib/visits';

const PAGE_SIZE = 20;

export default function HistoryScreen() {
  const { session, configured } = useAuth();

  if (!session) {
    return (
      <ScreenLayout
        title="Your visits"
        subtitle="The places that shape your taste profile."
      >
        <View style={styles.empty}>
          <Text style={styles.headline}>
            {configured ? 'Sign in to see your visits' : 'Auth not configured'}
          </Text>
          <Text style={styles.body}>
            {configured
              ? 'Your logged visits live in your account and train your recommendations.'
              : 'Set the Supabase env vars to enable accounts.'}
          </Text>
          {configured && (
            <View style={styles.signInButton}>
              <Button label="Sign in" onPress={() => router.push('/auth/sign-in')} />
            </View>
          )}
        </View>
      </ScreenLayout>
    );
  }

  return <VisitsList />;
}

function VisitsList() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((offset = 0) => {
    return listVisits(PAGE_SIZE, offset)
      .then((page) => {
        setTotal(page.total);
        setVisits((current) =>
          offset === 0 ? page.visits : [...current, ...page.visits],
        );
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load visits'),
      );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(0);
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(0);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (visits.length < total) void load(visits.length);
  };

  const onDelete = (visit: Visit) => {
    Alert.alert('Delete visit?', `Remove ${visit.restaurant.name} from history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVisit(visit.id);
            setVisits((current) => current.filter((v) => v.id !== visit.id));
            setTotal((current) => Math.max(current - 1, 0));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete visit');
          }
        },
      },
    ]);
  };

  return (
    <ScreenLayout
      title="Your visits"
      subtitle="The places that shape your taste profile."
    >
      {error && <Text style={styles.error}>{error}</Text>}
      {visits.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.headline}>No visits yet</Text>
          <Text style={styles.body}>
            Open a restaurant from Search and tap “Log a visit” after you eat
            there.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <VisitCard visit={item} onDelete={() => onDelete(item)} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenLayout>
  );
}

function VisitCard({ visit, onDelete }: { visit: Visit; onDelete: () => void }) {
  const date = new Date(visit.visited_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{visit.restaurant.name}</Text>
        <View style={styles.metaRow}>
          {visit.my_rating != null && (
            <Text style={styles.meta}>
              {'★'.repeat(visit.my_rating)}
              <Text style={styles.metaFaint}>{'★'.repeat(5 - visit.my_rating)}</Text>
            </Text>
          )}
          {dateLabel !== '' && <Text style={styles.metaFaint}>{dateLabel}</Text>}
          {visit.mood && <Text style={styles.metaFaint}>{visit.mood}</Text>}
        </View>
        {visit.dishes_ordered.length > 0 && (
          <Text style={styles.dishes}>{visit.dishes_ordered.join(' · ')}</Text>
        )}
        {visit.notes && <Text style={styles.notes}>{visit.notes}</Text>}
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Delete visit to ${visit.restaurant.name}`}
        style={({ pressed }) => pressed && { opacity: 0.5 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
    paddingBottom: space.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: space.sm,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...type.name,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'baseline',
  },
  meta: {
    ...type.meta,
    color: colors.accent,
  },
  metaFaint: {
    ...type.meta,
    color: colors.textFaint,
    fontWeight: '400',
  },
  dishes: {
    ...type.meta,
    color: colors.textMuted,
    fontWeight: '400',
  },
  notes: {
    ...type.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  empty: {
    marginTop: space.xl,
    gap: space.xs,
    alignItems: 'center',
  },
  headline: {
    ...type.body,
    color: colors.text,
    fontWeight: '600',
  },
  body: {
    ...type.body,
    color: colors.textMuted,
    maxWidth: 320,
    textAlign: 'center',
  },
  signInButton: {
    alignSelf: 'stretch',
    marginTop: space.md,
  },
  error: {
    ...type.body,
    color: colors.error,
  },
});
