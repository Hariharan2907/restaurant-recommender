import { Image, StyleSheet } from "react-native";
import { photoUrl } from "@/lib/photos";
export type PhotoImageProps = {
  photoRef: string;
  name: string;
  width: number;
  onError: () => void;
};
export function PhotoImage({
  photoRef,
  name,
  width,
  onError,
}: PhotoImageProps) {
  return (
    <Image
      accessibilityLabel={`${name} restaurant photo`}
      source={{ uri: photoUrl(photoRef, width) }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={onError}
    />
  );
}
