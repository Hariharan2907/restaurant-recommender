import { FlatList, StyleSheet, Text, View } from 'react-native';
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

function Card({ item }: { item: RestaurantResult }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.metaRow}>
        {item.rating != null && <Text style={styles.meta}>{item.rating.toFixed(1)}★</Text>}
        {item.price_tier != null && (
          <Text style={styles.meta}>{'$'.repeat(item.price_tier)}</Text>
        )}
        {item.cuisine && <Text style={styles.meta}>{item.cuisine}</Text>}
      </View>
      {item.address && <Text style={styles.address}>{item.address}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
    marginTop: space.md,
  },
  card: {
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
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
  address: {
    ...type.meta,
    color: colors.textFaint,
    marginTop: 4,
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
