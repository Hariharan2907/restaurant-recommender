import { StyleSheet, Text, View } from 'react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Button } from '@/components/Button';
import { colors, space, type } from '@/lib/theme';

export default function ProfileScreen() {
  return (
    <ScreenLayout
      title="Profile"
      subtitle="Your taste profile gets sharper the more you visit."
    >
      <View style={styles.rows}>
        <InfoRow label="Signed in as" value="Guest" />
        <InfoRow label="Visits logged" value="0" />
        <InfoRow label="Taste profile" value="Not yet trained" />
      </View>
      <View style={styles.buttonWrap}>
        <Button label="Manage account" variant="secondary" />
      </View>
    </ScreenLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    marginTop: space.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  rowLabel: {
    ...type.label,
    color: colors.textMuted,
  },
  rowValue: {
    ...type.body,
    color: colors.text,
    fontWeight: '500',
  },
  buttonWrap: {
    marginTop: space.lg,
  },
});
