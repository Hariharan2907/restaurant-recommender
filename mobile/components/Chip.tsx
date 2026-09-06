import { Pressable, StyleSheet, Text } from "react-native";
import { colors, space, type } from "@/lib/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected, disabled }}
      aria-pressed={onPress ? selected : undefined}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  text: {
    ...type.meta,
    color: colors.text,
  },
  textSelected: {
    color: colors.accent,
  },
});
