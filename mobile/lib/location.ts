import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export type LocationResult =
  | { kind: 'ok'; coords: Coords }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

export async function getDeviceLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { kind: 'denied' };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      kind: 'ok',
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
