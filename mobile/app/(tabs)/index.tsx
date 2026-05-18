import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { HealthCheck } from '@/components/HealthCheck';
import { HeroScreen } from '@/components/HeroScreen';
import { colors, heroImages, space, type } from '@/lib/theme';

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  return (
    <HeroScreen
      imageUri={heroImages.search}
      title="Find your next favorite"
      subtitle="Personalized for your taste, mood, and history."
      ctas={[
        { label: 'Search', variant: 'primary' },
        { label: 'Learn more', variant: 'secondary' },
      ]}
      topRight={<HealthCheck />}
    >
      <View style={styles.inputWrap}>
        <Text style={styles.label}>What are you craving?</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="cozy ramen spot near me"
          placeholderTextColor={colors.textOnDarkFaint}
          style={styles.input}
          returnKeyType="search"
          autoCapitalize="none"
        />
      </View>
    </HeroScreen>
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
});
