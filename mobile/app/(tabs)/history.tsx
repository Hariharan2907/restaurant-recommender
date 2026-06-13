import { StyleSheet, Text, View } from 'react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { colors, space, type } from '@/lib/theme';

export default function HistoryScreen() {
  return (
    <ScreenLayout
      title="Your visits"
      subtitle="The places that shape your taste profile."
    >
      <View style={styles.empty}>
        <Text style={styles.headline}>No visits yet</Text>
        <Text style={styles.body}>
          Log a visit after you eat somewhere new and it will appear here.
        </Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
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
});
