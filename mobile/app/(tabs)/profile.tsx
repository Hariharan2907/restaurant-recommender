import { StyleSheet, Text, View } from 'react-native';
import { HeroScreen } from '@/components/HeroScreen';
import { colors, heroImages, space, type } from '@/lib/theme';

export default function ProfileScreen() {
  return (
    <HeroScreen
      imageUri={heroImages.profile}
      title="Profile"
      subtitle="Your taste profile gets sharper the more you visit."
      ctas={[{ label: 'Manage account', variant: 'secondary' }]}
    >
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Signed in as</Text>
        <Text style={styles.rowValue}>Guest</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Visits logged</Text>
        <Text style={styles.rowValue}>0</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Taste profile</Text>
        <Text style={styles.rowValue}>Not yet trained</Text>
      </View>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  rowLabel: {
    ...type.label,
    color: colors.textOnDarkMuted,
  },
  rowValue: {
    ...type.body,
    color: colors.textOnDark,
    fontWeight: '500',
  },
});
