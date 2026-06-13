import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { ScreenLayout } from '@/components/ScreenLayout';
import { useAuth } from '@/lib/auth';
import { deleteAccount, getMe, updateMe, type UserProfile } from '@/lib/profile';
import { colors, space, type } from '@/lib/theme';

const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten_free'] as const;
const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export default function ProfileScreen() {
  const { session, loading: authLoading, signOut, configured } = useAuth();

  if (!session) {
    return (
      <ScreenLayout
        title="Profile"
        subtitle="Your taste profile gets sharper the more you visit."
      >
        <View style={styles.guestWrap}>
          <Text style={styles.guestHeadline}>
            {configured ? 'You’re browsing as a guest' : 'Auth not configured'}
          </Text>
          <Text style={styles.guestBody}>
            {configured
              ? 'Sign in to log visits, train your taste profile, and get personalized picks.'
              : 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable accounts.'}
          </Text>
          {configured && !authLoading && (
            <View style={styles.guestButtons}>
              <Button label="Sign in" onPress={() => router.push('/auth/sign-in')} />
              <Button
                label="Create account"
                variant="secondary"
                onPress={() => router.push('/auth/sign-up')}
              />
            </View>
          )}
        </View>
      </ScreenLayout>
    );
  }

  return <SignedInProfile onSignOut={signOut} />;
}

function SignedInProfile({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Draft form state
  const [displayName, setDisplayName] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);
  const [radius, setRadius] = useState(3000);
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    getMe()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setDisplayName(p.display_name ?? '');
        setDietary(p.dietary_preferences);
        setRadius(p.default_radius_m);
        setLikes(p.cuisine_likes.join(', '));
        setDislikes(p.cuisine_dislikes.join(', '));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load profile');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const toggleDietary = (option: string) => {
    setDietary((current) =>
      current.includes(option)
        ? current.filter((d) => d !== option)
        : [...current, option],
    );
  };

  const parseCsv = (value: string) =>
    value
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe({
        display_name: displayName.trim(),
        dietary_preferences: dietary,
        default_radius_m: radius,
        cuisine_likes: parseCsv(likes),
        cuisine_dislikes: parseCsv(dislikes),
      });
      setProfile(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile and visit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await onSignOut();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to delete account');
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenLayout
      title="Profile"
      subtitle="Your taste profile gets sharper the more you visit."
    >
      {profile === null ? (
        error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: space.xl }} color={colors.accent} />
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.rows}>
            <InfoRow
              label="Signed in as"
              value={profile.display_name || profile.email}
            />
            <InfoRow label="Visits logged" value={String(profile.visits_count)} />
            <InfoRow
              label="Taste profile"
              value={profile.taste_profile_trained ? 'Trained' : 'Not yet trained'}
            />
          </View>

          <Text style={styles.sectionTitle}>Preferences</Text>
          <FormField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we greet you?"
          />

          <View style={styles.chipSection}>
            <Text style={styles.chipLabel}>Dietary</Text>
            <View style={styles.chipRow}>
              {DIETARY_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option.replace('_', '-')}
                  selected={dietary.includes(option)}
                  onPress={() => toggleDietary(option)}
                />
              ))}
            </View>
          </View>

          <View style={styles.chipSection}>
            <Text style={styles.chipLabel}>Default search radius</Text>
            <View style={styles.chipRow}>
              {RADIUS_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={radius === option.value}
                  onPress={() => setRadius(option.value)}
                />
              ))}
            </View>
          </View>

          <FormField
            label="Cuisines you love (comma-separated)"
            value={likes}
            onChangeText={setLikes}
            placeholder="thai, ramen, pizza"
            autoCapitalize="none"
          />
          <FormField
            label="Cuisines to avoid"
            value={dislikes}
            onChangeText={setDislikes}
            placeholder="fast food"
            autoCapitalize="none"
          />

          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            label={saving ? 'Saving…' : 'Save preferences'}
            loading={saving}
            onPress={onSave}
          />

          <Text style={styles.sectionTitle}>Manage account</Text>
          <View style={styles.accountButtons}>
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => void onSignOut()}
            />
            <Button
              label="Delete account"
              variant="secondary"
              onPress={onDeleteAccount}
            />
          </View>
        </ScrollView>
      )}
    </ScreenLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  rows: {
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  rowLabel: {
    ...type.label,
    color: colors.textMuted,
  },
  rowValue: {
    ...type.body,
    color: colors.text,
    fontWeight: '500',
  },
  sectionTitle: {
    ...type.label,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  chipSection: {
    gap: space.xs,
  },
  chipLabel: {
    ...type.inputLabel,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  accountButtons: {
    gap: space.sm,
  },
  error: {
    ...type.body,
    color: colors.error,
  },
  guestWrap: {
    marginTop: space.xl,
    gap: space.sm,
    alignItems: 'center',
  },
  guestHeadline: {
    ...type.body,
    color: colors.text,
    fontWeight: '600',
  },
  guestBody: {
    ...type.body,
    color: colors.textMuted,
    maxWidth: 320,
    textAlign: 'center',
  },
  guestButtons: {
    alignSelf: 'stretch',
    gap: space.sm,
    marginTop: space.md,
  },
});
