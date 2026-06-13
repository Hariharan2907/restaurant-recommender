import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';

type Props = TextInputProps & {
  label: string;
  trailing?: ReactNode;
};

export function FormField({ label, trailing, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, style]}
          {...inputProps}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.xs,
  },
  label: {
    ...type.inputLabel,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  input: {
    ...type.input,
    flex: 1,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
});
