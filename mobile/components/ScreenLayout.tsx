import { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '@/lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  children: ReactNode;
};

const TAB_BAR_HEIGHT = Platform.select({ ios: 84, default: 68 }) ?? 68;

export function ScreenLayout({ title, subtitle, topRight, children }: Props) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Ionicons name="restaurant" size={26} color={colors.text} />
          <Text style={styles.title}>{title}</Text>
        </View>
        {topRight}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 1,
  },
  title: {
    ...type.display,
    color: colors.text,
  },
  subtitle: {
    ...type.subtitle,
    color: colors.textMuted,
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: TAB_BAR_HEIGHT + space.md,
  },
});
