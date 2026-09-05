import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, type } from "@/lib/theme";
import { photoUrl } from "@/lib/photos";

export function RestaurantPhoto({
  photoRef,
  name,
  height = 210,
  width = 800,
}: {
  photoRef?: string;
  name: string;
  height?: number;
  width?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const loadFailed = !!photoRef && failed === photoRef;
  return (
    <View style={[styles.frame, { height }]}>
      <View style={styles.fallback}>
        <View style={styles.plate}>
          <View style={styles.innerPlate}>
            <Ionicons
              name="restaurant-outline"
              size={32}
              color={colors.accent}
            />
          </View>
        </View>
        <Text numberOfLines={1} style={styles.caption}>
          {name}
        </Text>
        {loadFailed && <Text style={styles.note}>Photo unavailable</Text>}
      </View>
      {photoRef && failed !== photoRef && (
        <Image
          accessibilityLabel={`${name} restaurant photo`}
          source={{ uri: photoUrl(photoRef, width) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(photoRef)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { width: "100%", backgroundColor: "#E9EBDF", overflow: "hidden" },
  fallback: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6 },
  plate: {
    width: 95,
    height: 95,
    borderRadius: 50,
    backgroundColor: "#F7F7EE",
    borderWidth: 1,
    borderColor: "#D7DCCB",
    padding: 12,
    marginBottom: 6,
  },
  innerPlate: {
    flex: 1,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#D7DCCB",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { ...type.label, color: colors.accent, fontSize: 9 },
  note: { fontSize: 11, color: colors.textMuted },
});
