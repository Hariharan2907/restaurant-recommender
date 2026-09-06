import {
  useHydrated,
  useResponsiveDimensions,
} from "@/lib/useResponsiveDimensions";
import { Icon as Ionicons } from "@/components/Icon";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const { width } = useResponsiveDimensions();
  const hydrated = useHydrated();
  return (
    <Tabs
      tabBar={width >= 800 || !hydrated ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
        tabBarStyle:
          width >= 800
            ? { display: "none" }
            : {
                backgroundColor: colors.tabBarBg,
                borderTopColor: colors.hairline,
                height: Platform.OS === "ios" ? 84 : 70,
                paddingTop: 8,
                elevation: 0,
              },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Your visits",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Your taste",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
