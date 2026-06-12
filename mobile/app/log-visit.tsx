import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormField } from '@/components/FormField';
import { ScreenLayout } from '@/components/ScreenLayout';
import { capture } from '@/lib/analytics';
import { colors, space, type } from '@/lib/theme';
import { createVisit } from '@/lib/visits';

const MOOD_OPTIONS = ['casual', 'date night', 'celebration', 'quick bite', 'healthy'];

type ParamShape = {
  placeId: string;
  name: string;
  lat: string;
  lng: string;
  cuisine: string;
};

export default function LogVisitScreen() {
  const params = useLocalSearchParams<ParamShape>();
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [dishes, setDishes] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await createVisit({
        google_place_id: params.placeId ?? '',
        restaurant_name: params.name || undefined,
        lat: params.lat ? Number(params.lat) : undefined,
        lng: params.lng ? Number(params.lng) : undefined,
        cuisine: params.cuisine || undefined,
        my_rating: rating ?? undefined,
        mood: mood ?? undefined,
        dishes_ordered: dishes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
      });
      capture('visit_logged', { rated: rating != null, mood });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log visit');
      setBusy(false);
    }
  };

  return (
    <ScreenLayout
      title="Log a visit"
      subtitle={params.name ? `How was ${params.name}?` : 'How was it?'}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.label}>Your rating</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRating(value === rating ? null : value)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
                >
                  <Ionicons
                    name={rating != null && value <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={
                      rating != null && value <= rating
                        ? colors.accent
                        : colors.textFaint
                    }
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
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

          <FormField
            label="Dishes you ordered (comma-separated)"
            value={dishes}
            onChangeText={setDishes}
            placeholder="pad thai, mango sticky rice"
            autoCapitalize="none"
          />
          <FormField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember?"
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            label={busy ? 'Saving…' : 'Save visit'}
            loading={busy}
            onPress={onSave}
          />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  section: {
    gap: space.xs,
  },
  label: {
    ...type.inputLabel,
    color: colors.textMuted,
  },
  starRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    ...type.body,
    color: colors.error,
  },
});
