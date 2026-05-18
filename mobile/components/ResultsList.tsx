import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

function openInMaps(item: RestaurantResult) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    item.name,
  )}&query_place_id=${encodeURIComponent(item.google_place_id)}`;
  void Linking.openURL(url);
}

function Card({ item }: { item: RestaurantResult }) {
  return (
    <Pressable
      onPress={() => openInMaps(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} in Maps`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardBody}>
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
