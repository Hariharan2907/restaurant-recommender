import { useSyncExternalStore } from "react";
import { Platform, useWindowDimensions } from "react-native";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Match the static HTML on hydration, then use the actual responsive layout. */
export function useHydrated() {
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  return Platform.OS !== "web" || hydrated;
}

export function useResponsiveDimensions() {
  const dimensions = useWindowDimensions();
  const hydrated = useHydrated();
  if (hydrated) return dimensions;
  return { width: 390, height: 844, scale: 1, fontScale: 1 };
}
