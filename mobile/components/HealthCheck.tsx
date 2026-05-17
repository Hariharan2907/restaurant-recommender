import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/lib/api';

type Status = 'loading' | 'ok' | 'error';

export function HealthCheck() {
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
    status === 'loading'
      ? 'Checking...'
      : status === 'ok'
        ? 'Backend: ok'
        : 'Backend: unreachable';

  const pillStyle = [
    styles.pill,
    status === 'ok' && styles.ok,
    status === 'error' && styles.error,
    status === 'loading' && styles.loading,
  ];

  return (
    <View style={pillStyle}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  loading: {
    backgroundColor: '#e5e7eb',
  },
  ok: {
    backgroundColor: '#bbf7d0',
  },
  error: {
    backgroundColor: '#fecaca',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
});
