import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';
import type { ParsedFilters } from '@/lib/search';

export function FilterChips({ filters }: { filters: ParsedFilters }) {
  const chips: string[] = [];
  if (filters.cuisine) chips.push(filters.cuisine);
  if (filters.min_rating != null) chips.push(`${filters.min_rating.toFixed(1)}★`);
  if (filters.price_max != null) chips.push('$'.repeat(filters.price_max));
  for (const tag of filters.vibe_tags) chips.push(tag);
  for (const diet of filters.dietary) chips.push(diet);

  if (chips.length === 0) return null;

  return (
    <View style={styles.row}>
      {chips.map((label) => (
        <View key={label} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.sm,
  },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipText: {
    ...type.meta,
    color: colors.text,
  },
});
