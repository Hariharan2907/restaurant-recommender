import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: Props) {
  const isInactive = disabled || loading;
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      onPress={isInactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive }}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        isInactive && (isSecondary ? styles.secondaryDisabled : styles.primaryDisabled),
        pressed && !isInactive && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={isSecondary ? colors.text : colors.primaryText}
            style={styles.spinner}
          />
        )}
        <Text
          style={[
            styles.label,
            isSecondary ? styles.labelSecondary : styles.labelPrimary,
            isInactive &&
              (isSecondary ? styles.labelSecondaryDisabled : styles.labelPrimaryDisabled),
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primaryBg,
  },
  secondary: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  primaryDisabled: {
    backgroundColor: colors.primaryBgDisabled,
  },
  secondaryDisabled: {
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
  },
  pressed: {
    opacity: 0.75,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: space.sm,
  },
  label: {
    ...type.button,
  },
  labelPrimary: {
    color: colors.primaryText,
  },
  labelSecondary: {
    color: colors.secondaryText,
  },
  labelPrimaryDisabled: {
    color: colors.primaryTextDisabled,
  },
  labelSecondaryDisabled: {
    color: colors.textFaint,
  },
});
