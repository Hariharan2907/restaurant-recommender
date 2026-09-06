import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { useHydrated } from "@/lib/useResponsiveDimensions";
/** Icons decorate already-labeled controls and must not be read as font glyphs. */
export function Icon(props: ComponentProps<typeof Ionicons>) {
  const hydrated = useHydrated();
  // Font availability differs between the server and a browser's font cache.
  if (!hydrated) {
    const size = props.size ?? 24;
    return <View aria-hidden style={{ width: size, height: size }} />;
  }
  return (
    <Ionicons
      {...props}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  );
}
