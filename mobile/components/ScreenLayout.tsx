import { useResponsiveDimensions } from "@/lib/useResponsiveDimensions";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon as Ionicons } from "@/components/Icon";
import { router, usePathname } from "expo-router";
import { colors, serif, type } from "@/lib/theme";

type Props = {
  title?: string;
  subtitle?: string;
  topRight?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  scroll?: boolean;
};

export function ScreenLayout({
  title,
  subtitle,
  topRight,
  children,
  wide = false,
  scroll = false,
}: Props) {
  const { width } = useResponsiveDimensions();
  const compact = width < 600;
  const desktop = width >= 800;
  const path = usePathname();
  const isModal = path.startsWith("/auth") || path === "/log-visit";
  const onTab = path === "/" || path === "/history" || path === "/profile";
  const content = (
    <View
      role="main"
      style={[
        styles.inner,
        {
          maxWidth: wide ? 1200 : 760,
          paddingHorizontal: compact ? 20 : 40,
        },
        !scroll && { flex: 1 },
      ]}
    >
      {title && (
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[styles.title, compact && styles.titleCompact]}
          >
            {title}
          </Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      <View style={[styles.content, !scroll && { flex: 1 }]}>{children}</View>
    </View>
  );
  return (
    <SafeAreaView
      edges={
        onTab ? ["top", "left", "right"] : ["top", "bottom", "left", "right"]
      }
      style={styles.root}
    >
      <View role="banner" style={styles.header}>
        <View
          style={[
            styles.headerInner,
            {
              paddingHorizontal: compact ? 20 : 40,
              minHeight: desktop ? 80 : 56,
            },
          ]}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Fork home"
            onPress={() => router.navigate("/")}
            style={styles.brand}
          >
            <Ionicons
              name="restaurant-outline"
              size={desktop ? 25 : 22}
              color={colors.accent}
            />
            <Text
              style={[
                styles.wordmark,
                !desktop && { fontSize: 26, letterSpacing: -1 },
              ]}
            >
              fork<Text style={{ color: colors.terracotta }}>.</Text>
            </Text>
          </Pressable>
          {desktop && (
            <View role="navigation" style={styles.nav}>
              {(
                [
                  { href: "/", label: "Find a table", icon: "compass-outline" },
                  {
                    href: "/history",
                    label: "Your visits",
                    icon: "time-outline",
                  },
                  {
                    href: "/profile",
                    label: "Your taste",
                    icon: "options-outline",
                  },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.href}
                  accessibilityRole="link"
                  accessibilityState={{ selected: path === item.href }}
                  aria-current={path === item.href ? "page" : undefined}
                  onPress={() => router.navigate(item.href)}
                  style={[
                    styles.navLink,
                    path === item.href && styles.navActive,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={17}
                    color={
                      path === item.href ? colors.accent : colors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.navText,
                      path === item.href && { color: colors.accent },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {isModal ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close and go back"
              style={styles.iconButton}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              <Ionicons name="close" size={23} color={colors.text} />
            </Pressable>
          ) : desktop || !onTab ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Your profile"
              style={styles.iconButton}
              onPress={() => router.navigate("/profile")}
            >
              <Ionicons name="person-outline" size={20} color={colors.accent} />
            </Pressable>
          ) : null}
          {topRight}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  headerInner: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    minWidth: 0,
  },
  brand: { flexDirection: "row", gap: 10, alignItems: "center", minHeight: 44 },
  wordmark: {
    fontFamily: serif,
    fontSize: 35,
    fontWeight: "700",
    letterSpacing: -1.6,
    color: colors.text,
  },
  nav: { flexDirection: "row", gap: 28 },
  navLink: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 80,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  navActive: { borderBottomColor: colors.accent },
  navText: { ...type.button, color: colors.textMuted },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { width: "100%", alignSelf: "center", minWidth: 0 },
  heading: { paddingTop: 28, gap: 10, width: "100%" },
  title: { ...type.display, color: colors.text, maxWidth: "100%" },
  titleCompact: { fontSize: 30, lineHeight: 36 },
  subtitle: { ...type.subtitle, color: colors.textMuted, maxWidth: "100%" },
  content: { paddingTop: 20, paddingBottom: 24, width: "100%", minWidth: 0 },
});
