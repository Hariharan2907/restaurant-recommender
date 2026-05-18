import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/lib/api';
import { colors, type } from '@/lib/theme';

type Status = 'loading' | 'ok' | 'error';

export function HealthCheck() {
  if (!__DEV__) return null;
  return <HealthCheckInner />;
}

function HealthCheckInner() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/health')
      .then(() => {
        if (!cancelled) setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    status === 'loading' ? '•••' : status === 'ok' ? 'API · OK' : 'API · DOWN';

  const dotColor =
    status === 'ok'
      ? colors.devChipOkBg
      : status === 'error'
        ? colors.devChipErrBg
        : colors.devChipLoadingBg;

  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    ...type.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
