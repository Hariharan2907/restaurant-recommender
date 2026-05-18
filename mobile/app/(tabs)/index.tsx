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
import { HealthCheck } from '@/components/HealthCheck';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Button } from '@/components/Button';
import { FilterChips } from '@/components/FilterChips';
import { ResultsList } from '@/components/ResultsList';
import { colors, space, type } from '@/lib/theme';
import { getDeviceLocation, type Coords } from '@/lib/location';
import { search, type SearchResponse } from '@/lib/search';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const r = await getDeviceLocation();
      if (r.kind === 'ok') setCoords(r.coords);
      else if (r.kind === 'denied') setLocDenied(true);
      else setError(r.message);
    })();
  }, []);

  const onSearch = async () => {
    if (!coords) return;
    if (query.trim().length === 0) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const r = await search(query.trim(), coords);
      setResponse(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const searchDisabled = query.trim().length === 0 || coords === null;
  const showClear = query.length > 0 || response !== null;

  const clearSearch = () => {
    setQuery('');
    setResponse(null);
    setError(null);
    inputRef.current?.focus();
  };

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
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textFaint} />
                </Pressable>
              )}
            </View>
          </View>

          <Button
            label={loading ? 'Searching…' : 'Search'}
            loading={loading}
            disabled={searchDisabled}
            onPress={onSearch}
          />

          {locDenied && (
            <Text style={styles.warning}>Enable location to search nearby.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          {response && (
            <>
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
  inputSection: {
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
  warning: {
    ...type.body,
    color: colors.textMuted,
  },
  error: {
    ...type.body,
    color: colors.error,
  },
});
