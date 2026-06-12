import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { HealthCheck } from '@/components/HealthCheck';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FilterChips } from '@/components/FilterChips';
import { ResultsList } from '@/components/ResultsList';
import { capture } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { colors, space, type } from '@/lib/theme';
import { getDeviceLocation, type Coords } from '@/lib/location';
import {
  discover,
  recommend,
  type RecommendationsResponse,
} from '@/lib/recommendations';
import { search, type SearchResponse } from '@/lib/search';

type Mode = 'search' | 'forYou' | 'discover';

const MODES: { key: Mode; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'forYou', label: 'For you' },
  { key: 'discover', label: 'Discover' },
];

const MOOD_OPTIONS = ['cozy', 'date night', 'quick bite', 'healthy', 'celebration'];
const DIETARY_OPTIONS = [
  { key: 'vegetarian', label: 'vegetarian' },
  { key: 'vegan', label: 'vegan' },
  { key: 'gluten_free', label: 'gluten-free' },
];

export default function SearchScreen() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [dietary, setDietary] = useState<string[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const r = await getDeviceLocation();
      if (r.kind === 'ok') setCoords(r.coords);
      else if (r.kind === 'denied') setLocDenied(true);
      else setError(r.message);
    })();
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setResponse(null);
    setError(null);
    setPersonalized(false);
  };

  // Dietary needs are hard requirements — make sure the parser sees them even
  // when the user doesn't type them.
  const effectiveQuery = () => {
    const parts = [query.trim()];
    for (const d of dietary) parts.push(d.replace('_', ' '));
    return parts.filter(Boolean).join(' ');
  };

  const onSearch = async () => {
    if (!coords) return;
    if (mode !== 'discover' && effectiveQuery().length === 0) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    capture('search_submitted', { mode, mood, dietary });
    try {
      if (mode === 'search') {
        const r = await search(effectiveQuery(), coords);
        setResponse(r);
        setPersonalized(false);
      } else if (mode === 'forYou') {
        const r: RecommendationsResponse = await recommend(
          effectiveQuery(),
          coords,
          mood ?? undefined,
        );
        setResponse(r);
        setPersonalized(r.personalized);
      } else {
        const r = await discover(coords);
        setResponse({
          parsed_filters: {
            cuisine: null,
            min_rating: null,
            vibe_tags: [],
            dietary: [],
            price_max: null,
            intent: null,
          },
          results: r.results,
          cached: false,
        });
        setPersonalized(r.personalized);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const needsQuery = mode !== 'discover';
  const actionDisabled =
    coords === null || (needsQuery && effectiveQuery().length === 0);
  const showClear = query.length > 0 || response !== null;

  const clearSearch = () => {
    setQuery('');
    setResponse(null);
    setError(null);
    inputRef.current?.focus();
  };

  const actionLabel =
    mode === 'search'
      ? 'Search'
      : mode === 'forYou'
        ? 'Get recommendations'
        : 'Surprise me';

  return (
    <ScreenLayout
      title="Find a restaurant"
      subtitle="Personalized for your taste, mood, and history."
      topRight={<HealthCheck />}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modeRow}>
            {MODES.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                selected={mode === m.key}
                onPress={() => switchMode(m.key)}
              />
            ))}
          </View>

          {mode === 'discover' && !session ? (
            <View style={styles.discoverGate}>
              <Text style={styles.warning}>
                Discover finds new spots similar to the places you’ve loved.
                Sign in to use it.
              </Text>
              <Button label="Sign in" onPress={() => router.push('/auth/sign-in')} />
            </View>
          ) : (
            <>
              {needsQuery && (
                <View style={styles.inputSection}>
                  <Text style={styles.label}>What are you craving?</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      ref={inputRef}
                      value={query}
                      onChangeText={setQuery}
                      onSubmitEditing={onSearch}
                      placeholder="cozy ramen near me"
                      placeholderTextColor={colors.textFaint}
                      style={styles.input}
                      returnKeyType="search"
                      autoCapitalize="none"
                      editable={coords !== null}
                    />
                    {showClear && (
                      <Pressable
                        onPress={clearSearch}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        style={({ pressed }) => [
                          styles.clearBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={colors.textFaint}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {mode === 'forYou' && (
                <View style={styles.chipSection}>
                  <Text style={styles.label}>Mood</Text>
                  <View style={styles.chipRow}>
                    {MOOD_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        selected={mood === option}
                        onPress={() => setMood(mood === option ? null : option)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {needsQuery && (
                <View style={styles.chipSection}>
                  <Text style={styles.label}>Dietary</Text>
                  <View style={styles.chipRow}>
                    {DIETARY_OPTIONS.map((option) => (
                      <Chip
                        key={option.key}
                        label={option.label}
                        selected={dietary.includes(option.key)}
                        onPress={() =>
                          setDietary((current) =>
                            current.includes(option.key)
                              ? current.filter((d) => d !== option.key)
                              : [...current, option.key],
                          )
                        }
                      />
                    ))}
                  </View>
                </View>
              )}

              <Button
                label={loading ? 'Working…' : actionLabel}
                loading={loading}
                disabled={actionDisabled}
                onPress={onSearch}
              />
            </>
          )}

          {locDenied && (
            <Text style={styles.warning}>Enable location to search nearby.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          {response && (
            <>
              {personalized && (
                <View style={styles.personalizedBadge}>
                  <Ionicons name="sparkles" size={14} color={colors.accent} />
                  <Text style={styles.personalizedText}>
                    Ranked for your taste
                  </Text>
                </View>
              )}
              <FilterChips filters={response.parsed_filters} />
              <ResultsList results={response.results} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: space.md,
    paddingBottom: space.lg,
  },
  modeRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  inputSection: {
    gap: space.xs,
  },
  chipSection: {
    gap: space.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  clearBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  discoverGate: {
    gap: space.md,
  },
  personalizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xs,
  },
  personalizedText: {
    ...type.meta,
    color: colors.accent,
  },
  warning: {
    ...type.body,
    color: colors.textMuted,
  },
  error: {
    ...type.body,
    color: colors.error,
  },
});
