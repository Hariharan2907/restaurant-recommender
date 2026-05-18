import { StyleSheet, Text, View } from 'react-native';
import { HeroScreen } from '@/components/HeroScreen';
import { colors, heroImages, space, type } from '@/lib/theme';

export default function HistoryScreen() {
  return (
    <HeroScreen
      imageUri={heroImages.history}
      title="Your visits"
      subtitle="The places that shape your taste profile."
    >
      <View style={styles.empty}>
        <Text style={styles.emptyLabel}>No visits yet</Text>
        <Text style={styles.emptyHint}>
          Log a visit after you eat somewhere new and it will appear here.
        </Text>
      </View>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginTop: space.lg,
    gap: space.xs,
  },
  emptyLabel: {
    ...type.label,
    color: colors.textOnDarkMuted,
  },
  emptyHint: {
    ...type.body,
    color: colors.textOnDarkMuted,
    maxWidth: 320,
  },
});
