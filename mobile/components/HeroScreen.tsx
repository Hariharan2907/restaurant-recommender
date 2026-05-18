import { ReactNode } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, space, type } from '@/lib/theme';

type CTA = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
};

type Props = {
  imageUri: string;
  title: string;
  subtitle?: string;
  ctas?: CTA[];
  children?: ReactNode;
  topRight?: ReactNode;
  contentStyle?: ViewStyle;
};

export function HeroScreen({
  imageUri,
  title,
  subtitle,
  ctas,
  children,
  topRight,
  contentStyle,
}: Props) {
  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: imageUri }}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topBar} pointerEvents="box-none">
          <Text style={styles.brand}>FORK</Text>
          {topRight}
        </View>

        <View style={[styles.content, contentStyle]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {children}
          {ctas && ctas.length > 0 && (
            <View style={styles.ctaRow}>
              {ctas.map((cta) => (
                <Pressable
                  key={cta.label}
                  onPress={cta.onPress}
                  style={({ pressed }) => [
                    styles.cta,
                    cta.variant === 'secondary'
                      ? styles.ctaSecondary
                      : styles.ctaPrimary,
                    pressed && styles.ctaPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.ctaLabel,
                      cta.variant === 'secondary'
                        ? styles.ctaLabelSecondary
                        : styles.ctaLabelPrimary,
                    ]}
                  >
                    {cta.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  bg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: space.xxl,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  brand: {
    color: colors.textOnDark,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl + space.xl,
    gap: space.md,
    zIndex: 1,
  },
  title: {
    ...type.display,
    color: colors.textOnDark,
  },
  subtitle: {
    ...type.subtitle,
    color: colors.textOnDarkMuted,
    maxWidth: 320,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
    flexWrap: 'wrap',
  },
  cta: {
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 132,
    alignItems: 'center',
  },
  ctaPrimary: {
    backgroundColor: colors.primaryBg,
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    backgroundColor: 'transparent',
  },
  ctaPressed: {
    opacity: 0.75,
  },
  ctaLabel: {
    ...type.cta,
  },
  ctaLabelPrimary: {
    color: colors.primaryText,
  },
  ctaLabelSecondary: {
    color: colors.secondaryText,
  },
});
