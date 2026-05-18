import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HealthCheck } from '@/components/HealthCheck';
import { HeroScreen } from '@/components/HeroScreen';
import { FilterChips } from '@/components/FilterChips';
import { ResultsList } from '@/components/ResultsList';
import { colors, heroImages, space, type } from '@/lib/theme';
import { getDeviceLocation, type Coords } from '@/lib/location';
import { search, type SearchResponse } from '@/lib/search';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);

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

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <HeroScreen
        imageUri={heroImages.search}
        title="Find your next favorite"
        subtitle="Personalized for your taste, mood, and history."
        ctas={[
          { label: loading ? 'Searching…' : 'Search', variant: 'primary', onPress: onSearch },
          { label: 'Learn more', variant: 'secondary' },
        ]}
        topRight={<HealthCheck />}
      >
        <View style={styles.inputWrap}>
          <Text style={styles.label}>What are you craving?</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            placeholder="cozy ramen spot near me"
            placeholderTextColor={colors.textOnDarkFaint}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            editable={coords !== null}
          />
          {locDenied && (
            <Text style={styles.warning}>Enable location to search nearby.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        {response && (
          <>
            <FilterChips filters={response.parsed_filters} />
            <ResultsList results={response.results} />
          </>
        )}
      </HeroScreen>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    gap: space.xs,
    marginTop: space.sm,
  },
  label: {
    ...type.label,
    color: colors.textOnDarkMuted,
  },
  input: {
    color: colors.textOnDark,
    fontSize: 17,
    fontWeight: '300',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  warning: {
    ...type.label,
    color: colors.textOnDarkFaint,
  },
  error: {
    ...type.label,
    color: '#ff6b6b',
  },
});
