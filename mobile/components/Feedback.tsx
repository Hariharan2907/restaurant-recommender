import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, type } from "@/lib/theme";

export function EmptyState({
  icon = "restaurant-outline",
  title,
  description,
  children,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={30} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{description}</Text>
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, error && { backgroundColor: colors.errorBg }]}
    >
      <Ionicons
        name={error ? "alert-circle-outline" : "information-circle-outline"}
        size={20}
        color={error ? colors.error : colors.accent}
      />
      <Text style={[styles.noticeText, error && { color: colors.error }]}>
        {children}
      </Text>
    </View>
  );
}
export function ResultsSkeleton() {
  return (
    <View
      accessibilityLabel="Finding restaurants"
      accessibilityRole="progressbar"
      style={styles.skeletonGrid}
    >
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={{ height: 180, backgroundColor: colors.surface }} />
          <View style={{ padding: 20, gap: 12 }}>
            <View style={styles.line} />
            <View style={[styles.line, { width: "55%" }]} />
            <View style={[styles.line, { height: 42 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  empty: {
    padding: 32,
    gap: 12,
    alignItems: "center",
    alignSelf: "stretch",
    width: "100%",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 20,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    ...type.heading,
    color: colors.text,
    textAlign: "center",
    alignSelf: "stretch",
  },
  body: {
    ...type.body,
    color: colors.textMuted,
    textAlign: "center",
    alignSelf: "stretch",
    maxWidth: 420,
  },
  actions: { width: "100%", maxWidth: 330, gap: 10, marginTop: 10 },
  notice: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "stretch",
    width: "100%",
    gap: 10,
  },
  noticeText: {
    ...type.meta,
    flex: 1,
    minWidth: 0,
    color: colors.accent,
  },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  skeletonCard: {
    flexBasis: 280,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 18,
    overflow: "hidden",
  },
  line: {
    height: 16,
    width: "85%",
    backgroundColor: colors.surface,
    borderRadius: 5,
  },
});
