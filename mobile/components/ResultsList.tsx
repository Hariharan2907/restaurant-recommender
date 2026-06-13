import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, space, type } from '@/lib/theme';
import type { RestaurantResult } from '@/lib/search';

export function ResultsList({ results }: { results: RestaurantResult[] }) {
  if (results.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No spots match. Try widening your search.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(r) => r.google_place_id}
      renderItem={({ item }) => <Card item={item} />}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

function formatRatingCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toString();
}

function openDetail(item: RestaurantResult) {
  router.push({
    pathname: '/restaurant/[placeId]',
    params: {
      placeId: item.google_place_id,
      name: item.name,
      rating: item.rating ?? '',
      userRatingsTotal: item.user_ratings_total ?? '',
      priceTier: item.price_tier ?? '',
      cuisine: item.cuisine ?? '',
      address: item.address ?? '',
      photoRefs: JSON.stringify(item.photo_refs ?? []),
      explanation: item.explanation ?? '',
    },
  });
}

function Card({ item }: { item: RestaurantResult }) {
  return (
    <Pressable
      onPress={() => openDetail(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} details`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.metaRow}>
          {item.rating != null && (
            <Text style={styles.meta}>
              {item.rating.toFixed(1)}★
              {item.user_ratings_total != null && (
                <Text style={styles.metaFaint}> ({formatRatingCount(item.user_ratings_total)})</Text>
              )}
            </Text>
          )}
          {item.price_tier != null && (
            <Text style={styles.meta}>{'$'.repeat(item.price_tier)}</Text>
          )}
          {item.cuisine && <Text style={styles.meta}>{item.cuisine}</Text>}
        </View>
        {item.address && <Text style={styles.address}>{item.address}</Text>}
        {item.explanation && <Text style={styles.reason}>{item.explanation}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
    marginTop: space.md,
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
  cardPressed: {
    opacity: 0.7,
  },
  cardBody: {
    flex: 1,
  },
  name: {
    ...type.name,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 4,
  },
  meta: {
    ...type.meta,
    color: colors.textMuted,
  },
  metaFaint: {
    ...type.meta,
    color: colors.textFaint,
    fontWeight: '400',
  },
  address: {
    ...type.meta,
    color: colors.textFaint,
    marginTop: 4,
  },
  reason: {
    ...type.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    marginTop: 6,
  },
  emptyWrap: {
    marginTop: space.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
  },
});
