import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth';
import { getDishes, type Dish } from '@/lib/recommendations';
import { colors, space, type } from '@/lib/theme';
import { photoUrl } from '@/lib/photos';

type ParamShape = {
  placeId: string;
  name: string;
  rating: string;
  userRatingsTotal: string;
  priceTier: string;
  cuisine: string;
  address: string;
  lat: string;
  lng: string;
  photoRefs: string;
  explanation: string;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_HEIGHT = 240;

export default function RestaurantDetail() {
  const params = useLocalSearchParams<ParamShape>();
  const { session } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);

  const name = params.name ?? '';
  const placeId = params.placeId ?? '';
  const rating = params.rating ? Number(params.rating) : null;
  const ratingsCount = params.userRatingsTotal ? Number(params.userRatingsTotal) : null;
  const priceTier = params.priceTier ? Number(params.priceTier) : null;
  const cuisine = params.cuisine || null;
  const address = params.address || null;
  const explanation = params.explanation || null;

  const photoRefs = useMemo<string[]>(() => {
    try {
      const parsed = params.photoRefs ? JSON.parse(params.photoRefs) : [];
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }, [params.photoRefs]);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getDishes(placeId)
      .then((r) => {
        if (!cancelled) setDishes(r.dishes);
      })
      .catch(() => {
        // dishes are progressive enhancement — ignore failures
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  const onLogVisit = () => {
    if (!session) {
      router.push('/auth/sign-in');
      return;
    }
    router.push({
      pathname: '/log-visit',
      params: {
        placeId,
        name,
        lat: params.lat ?? '',
        lng: params.lng ?? '',
        cuisine: params.cuisine ?? '',
      },
    });
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      name,
    )}&query_place_id=${encodeURIComponent(placeId)}`;
    void Linking.openURL(url);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.chrome}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {photoRefs.length > 0 ? (
          <FlatList
            data={photoRefs}
            keyExtractor={(ref) => ref}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Image
                source={{ uri: photoUrl(item, 1200) }}
                style={styles.photo}
                resizeMode="cover"
              />
            )}
            style={styles.photoList}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="restaurant" size={56} color={colors.textFaint} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{name}</Text>

          <View style={styles.metaRow}>
            {rating != null && !Number.isNaN(rating) && (
              <Text style={styles.meta}>
                {rating.toFixed(1)}★
                {ratingsCount != null && !Number.isNaN(ratingsCount) && (
                  <Text style={styles.metaFaint}> ({ratingsCount.toLocaleString()})</Text>
                )}
              </Text>
            )}
            {priceTier != null && !Number.isNaN(priceTier) && (
              <Text style={styles.meta}>{'$'.repeat(priceTier)}</Text>
            )}
            {cuisine && <Text style={styles.meta}>{cuisine}</Text>}
          </View>

          {address && <Text style={styles.address}>{address}</Text>}

          {explanation && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Why it matches</Text>
              <Text style={styles.reasonText}>{explanation}</Text>
            </View>
          )}

          {dishes.length > 0 && (
            <View style={styles.dishesBox}>
              <Text style={styles.dishesLabel}>Popular dishes</Text>
              {dishes.slice(0, 6).map((dish) => (
                <View key={dish.dish_name} style={styles.dishRow}>
                  <Text style={styles.dishName}>{dish.dish_name}</Text>
                  <Text style={styles.dishMeta}>
                    {dish.mention_count} mention
                    {dish.mention_count === 1 ? '' : 's'}
                  </Text>
                </View>
              ))}
              <Text style={styles.attribution}>
                Dish data derived from Google and Yelp reviews.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button label="Log a visit" onPress={onLogVisit} />
            <Button
              label="Open in Google Maps"
              variant="secondary"
              onPress={openInMaps}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  chrome: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scroll: {
    paddingBottom: space.xxl,
  },
  photoList: {
    height: PHOTO_HEIGHT,
  },
  photo: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: colors.surface,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  name: {
    ...type.display,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  meta: {
    ...type.meta,
    color: colors.textMuted,
  },
  metaFaint: {
    ...type.meta,
    color: colors.textFaint,
    fontWeight: '400',
  },
  address: {
    ...type.body,
    color: colors.textMuted,
  },
  reasonBox: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    gap: space.xs,
  },
  reasonLabel: {
    ...type.label,
    color: colors.accent,
  },
  reasonText: {
    ...type.body,
    color: colors.text,
  },
  actions: {
    marginTop: space.md,
    gap: space.sm,
  },
  dishesBox: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: space.xs,
  },
  dishesLabel: {
    ...type.label,
    color: colors.textMuted,
  },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 4,
  },
  dishName: {
    ...type.body,
    color: colors.text,
    fontWeight: '500',
  },
  dishMeta: {
    ...type.meta,
    color: colors.textFaint,
    fontWeight: '400',
  },
  attribution: {
    ...type.meta,
    fontSize: 11,
    color: colors.textFaint,
    fontWeight: '400',
    marginTop: space.xs,
  },
});
