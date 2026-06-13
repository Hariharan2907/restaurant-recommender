# Mobile UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark/hero-image mobile UI with a clean light design built on a shared `ScreenLayout` + `Button` component, fix the keyboard covering the search input, and make every button visually unambiguous.

**Architecture:** A new lightweight `ScreenLayout` (SafeArea + title + subtitle + content) replaces `HeroScreen`. A new `Button` component owns primary/secondary/disabled/loading states. The dark palette in `mobile/lib/theme.ts` is replaced with a light one; old keys are kept as deprecated aliases during the migration so files still compile. Each tab screen (`index.tsx`, `history.tsx`, `profile.tsx`) is rewritten to use the new layout. Search adds `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` so the input is always visible and the button tappable while typing.

**Tech Stack:** React Native (Expo SDK 54), expo-router 6, TypeScript, `react-native-safe-area-context` (already a dep), `react-native` core primitives. No new packages required.

**Spec:** `docs/superpowers/specs/2026-05-18-mobile-ui-overhaul-design.md`

**Branch:** Stacks on `phase-2-core-search` (per user decision). All commits go into PR #2.

---

## Working notes for the implementer

- **No backend changes.** All Phase 2 backend code and tests are untouched. Run `cd backend && pytest -q` once at the end to confirm; do not modify backend files during this work.
- **Test mechanic for this plan:** mobile has no jest/RNTL setup. Per task: run `cd mobile && npx tsc --noEmit` to verify the TypeScript still compiles. This catches missing imports, prop-shape mismatches, and palette-key typos. A manual iPhone smoke pass happens in the final task.
- **Commit cadence:** one commit per task. Stay on `phase-2-core-search`. Don't create a new branch. Don't push between tasks (the final task handles push).
- **Compilation-stability invariant:** every task ends with `npx tsc --noEmit` passing. The mid-migration UI may look visually weird (e.g., light-grey FilterChips floating on a dark hero image after Task 5 but before Task 7) — that's expected and resolves itself by Task 12.
- **Do not delete `expo-linear-gradient` from `package.json`.** Per spec, the package stays even after `HeroScreen` is deleted, to avoid an install cycle. A separate housekeeping commit can prune it later.
- **`__DEV__` is a global constant** provided by React Native — TypeScript may not know about it. If you get a "Cannot find name '__DEV__'" error in Task 7, ensure the file is using `declare const __DEV__: boolean;` at the top OR rely on `@types/react-native` providing it (it does in current versions; this should be a no-op).

---

## Task 1: Rewrite `theme.ts` with light palette + new type scale (deprecated keys kept as aliases)

**Files:**
- Modify: `mobile/lib/theme.ts`

**Why:** Foundational. New components added in later tasks pull from these keys. Old key names are kept as aliases (mapped to new values) so existing files compile until they're migrated in Tasks 5–10.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `mobile/lib/theme.ts` with:

```ts
export const colors = {
  // ---- DEPRECATED — removed in Task 14 ----
  // Old names kept so unmigrated files still compile during the migration window.
  // Values point at the new palette so visuals are consistent post-Task 1.
  black: '#0a0a0a',
  white: '#ffffff',
  textOnDark: '#0a0a0a',
  textOnDarkMuted: '#525252',
  textOnDarkFaint: '#a3a3a3',

  // ---- ACTIVE PALETTE ----
  // Surfaces
  bg: '#ffffff',
  surface: '#f5f5f7',
  surfaceAlt: '#fafafa',

  // Text
  text: '#0a0a0a',
  textMuted: '#525252',
  textFaint: '#a3a3a3',

  // Lines
  hairline: '#e5e5e5',

  // Buttons
  primaryBg: '#0a0a0a',
  primaryText: '#ffffff',
  primaryBgDisabled: '#e5e5e5',
  primaryTextDisabled: '#a3a3a3',
  secondaryBorder: '#0a0a0a',
  secondaryText: '#0a0a0a',

  // Status
  error: '#dc2626',

  // Tab bar
  tabBarBg: '#ffffff',
  tabActive: '#0a0a0a',
  tabInactive: '#a3a3a3',

  // Dev-only HealthCheck dots
  devChipOkBg: 'rgba(34, 197, 94, 0.85)',
  devChipErrBg: 'rgba(239, 68, 68, 0.85)',
  devChipLoadingBg: '#e5e5e5',
} as const;

export const type = {
  // Active scale
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  subtitle: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  inputLabel: { fontSize: 13, fontWeight: '600' as const },
  input: { fontSize: 17, fontWeight: '400' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  name: { fontSize: 17, fontWeight: '600' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  // ---- DEPRECATED — removed in Task 14 ----
  cta: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;

// ---- DEPRECATED — removed in Task 14 ----
// HeroScreen and the three unmigrated screens still reference this until Tasks 8–10 + 13.
export const heroImages = {
  search:
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1080&q=80&fit=crop&auto=format',
  history:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1080&q=80&fit=crop&auto=format',
  profile:
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1080&q=80&fit=crop&auto=format',
} as const;
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS (no errors). If errors appear, they're real — investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/theme.ts
git commit -m "ui: replace theme palette with light scheme (deprecated keys kept as aliases)

New light palette + type scale lands here. Existing files (HeroScreen,
FilterChips, ResultsList, HealthCheck, three tab screens) keep compiling
via deprecated aliases (textOnDark*, cta, heroImages). They get migrated
to the new keys in subsequent commits and the aliases are removed at the
end of the overhaul.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Add `Button` component

**Files:**
- Create: `mobile/components/Button.tsx`

**Why:** Reusable primary/secondary button with disabled + loading states. Used by Search and Profile screens in later tasks. Encapsulates press feedback and accessibility.

- [ ] **Step 1: Create the file**

Create `mobile/components/Button.tsx` with:

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: Props) {
  const isInactive = disabled || loading;
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      onPress={isInactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive }}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        isInactive && (isSecondary ? styles.secondaryDisabled : styles.primaryDisabled),
        pressed && !isInactive && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={isSecondary ? colors.text : colors.primaryText}
            style={styles.spinner}
          />
        )}
        <Text
          style={[
            styles.label,
            isSecondary ? styles.labelSecondary : styles.labelPrimary,
            isInactive &&
              (isSecondary ? styles.labelSecondaryDisabled : styles.labelPrimaryDisabled),
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primaryBg,
  },
  secondary: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  primaryDisabled: {
    backgroundColor: colors.primaryBgDisabled,
  },
  secondaryDisabled: {
    backgroundColor: colors.bg,
    borderColor: colors.hairline,
  },
  pressed: {
    opacity: 0.75,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: space.sm,
  },
  label: {
    ...type.button,
  },
  labelPrimary: {
    color: colors.primaryText,
  },
  labelSecondary: {
    color: colors.secondaryText,
  },
  labelPrimaryDisabled: {
    color: colors.primaryTextDisabled,
  },
  labelSecondaryDisabled: {
    color: colors.textFaint,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/Button.tsx
git commit -m "ui: add Button component with primary/secondary/disabled/loading variants

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Add `ScreenLayout` component

**Files:**
- Create: `mobile/components/ScreenLayout.tsx`

**Why:** Shared layout for every tab. Replaces `HeroScreen`. SafeArea + title row + optional subtitle + content area. White background. The content area reserves bottom padding for the tab bar.

- [ ] **Step 1: Create the file**

Create `mobile/components/ScreenLayout.tsx` with:

```tsx
import { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, type } from '@/lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  children: ReactNode;
};

const TAB_BAR_HEIGHT = Platform.select({ ios: 84, default: 68 }) ?? 68;

export function ScreenLayout({ title, subtitle, topRight, children }: Props) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {topRight}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  title: {
    ...type.display,
    color: colors.text,
  },
  subtitle: {
    ...type.subtitle,
    color: colors.textMuted,
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: TAB_BAR_HEIGHT + space.md,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ScreenLayout.tsx
git commit -m "ui: add ScreenLayout component (SafeArea + title + subtitle + content)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Migrate `FilterChips` to new palette

**Files:**
- Modify: `mobile/components/FilterChips.tsx`

**Why:** Drop the `(colors as any).chipBg` fallback workaround and use the real `surfaceAlt`/`hairline`/`text` keys. Behaviorally unchanged.

- [ ] **Step 1: Replace the file contents**

Replace `mobile/components/FilterChips.tsx` with:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';
import type { ParsedFilters } from '@/lib/search';

export function FilterChips({ filters }: { filters: ParsedFilters }) {
  const chips: string[] = [];
  if (filters.cuisine) chips.push(filters.cuisine);
  if (filters.min_rating != null) chips.push(`${filters.min_rating.toFixed(1)}★`);
  if (filters.price_max != null) chips.push('$'.repeat(filters.price_max));
  for (const tag of filters.vibe_tags) chips.push(tag);
  for (const diet of filters.dietary) chips.push(diet);

  if (chips.length === 0) return null;

  return (
    <View style={styles.row}>
      {chips.map((label) => (
        <View key={label} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.sm,
  },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipText: {
    ...type.meta,
    color: colors.text,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/FilterChips.tsx
git commit -m "ui: restyle FilterChips for light theme

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Migrate `ResultsList` to new palette

**Files:**
- Modify: `mobile/components/ResultsList.tsx`

**Why:** Light card surfaces, sharper hierarchy (name 17/600, meta 13/500 muted, address 13 faint).

- [ ] **Step 1: Replace the file contents**

Replace `mobile/components/ResultsList.tsx` with:

```tsx
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';
import type { RestaurantResult } from '@/lib/search';

export function ResultsList({ results }: { results: RestaurantResult[] }) {
  if (results.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No spots match. Try widening your search.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(r) => r.google_place_id}
      renderItem={({ item }) => <Card item={item} />}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

function Card({ item }: { item: RestaurantResult }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.metaRow}>
        {item.rating != null && <Text style={styles.meta}>{item.rating.toFixed(1)}★</Text>}
        {item.price_tier != null && (
          <Text style={styles.meta}>{'$'.repeat(item.price_tier)}</Text>
        )}
        {item.cuisine && <Text style={styles.meta}>{item.cuisine}</Text>}
      </View>
      {item.address && <Text style={styles.address}>{item.address}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
    marginTop: space.md,
  },
  card: {
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  name: {
    ...type.name,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 4,
  },
  meta: {
    ...type.meta,
    color: colors.textMuted,
  },
  address: {
    ...type.meta,
    color: colors.textFaint,
    marginTop: 4,
  },
  emptyWrap: {
    marginTop: space.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ResultsList.tsx
git commit -m "ui: restyle ResultsList cards for light theme

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Migrate `HealthCheck` to new palette and gate on `__DEV__`

**Files:**
- Modify: `mobile/components/HealthCheck.tsx`

**Why:** Light chip + dev-only rendering. The `__DEV__` gate hides the chip in production builds without affecting development ergonomics. The gate uses a wrapper component so the inner hooks rules stay clean (hooks must be called unconditionally per render).

- [ ] **Step 1: Replace the file contents**

Replace `mobile/components/HealthCheck.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

If you see `Cannot find name '__DEV__'`, add this at the very top of the file (before imports):
```ts
declare const __DEV__: boolean;
```
Then re-run typecheck. (Recent `@types/react-native` versions provide `__DEV__` globally, so this is usually unnecessary.)

- [ ] **Step 3: Commit**

```bash
git add mobile/components/HealthCheck.tsx
git commit -m "ui: restyle HealthCheck for light theme + hide in production builds

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Rebuild Search screen on `ScreenLayout` + `Button` with keyboard handling

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

**Why:** Top-anchored layout, filled-style input, full-width Search button, `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` to fix the keyboard-covers-input bug. Drops the "Learn more" CTA. Drops `HeroScreen` and `heroImages.search`.

- [ ] **Step 1: Replace the file contents**

Replace `mobile/app/(tabs)/index.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

  const searchDisabled = query.trim().length === 0 || coords === null;

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
            <TextInput
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
  input: {
    ...type.input,
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderRadius: 12,
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
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx
git commit -m "ui: rebuild Search screen on ScreenLayout + Button with keyboard fix

- Top-anchored layout puts the input in the upper third of the screen.
- KeyboardAvoidingView (iOS) pads the layout when the keyboard opens.
- keyboardShouldPersistTaps='handled' lets the Search button fire on
  the first tap while the keyboard is open.
- 'Learn more' CTA removed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Rebuild History screen on `ScreenLayout`

**Files:**
- Modify: `mobile/app/(tabs)/history.tsx`

**Why:** Drops `HeroScreen` + `heroImages.history`. Empty state stays the same copy; centered + light styled.

- [ ] **Step 1: Replace the file contents**

Replace `mobile/app/(tabs)/history.tsx` with:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { colors, space, type } from '@/lib/theme';

export default function HistoryScreen() {
  return (
    <ScreenLayout
      title="Your visits"
      subtitle="The places that shape your taste profile."
    >
      <View style={styles.empty}>
        <Text style={styles.headline}>No visits yet</Text>
        <Text style={styles.body}>
          Log a visit after you eat somewhere new and it will appear here.
        </Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginTop: space.xl,
    gap: space.xs,
    alignItems: 'center',
  },
  headline: {
    ...type.body,
    color: colors.text,
    fontWeight: '600',
  },
  body: {
    ...type.body,
    color: colors.textMuted,
    maxWidth: 320,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/history.tsx
git commit -m "ui: rebuild History screen on ScreenLayout

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Rebuild Profile screen on `ScreenLayout` + `Button`

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`

**Why:** Drops `HeroScreen` + `heroImages.profile`. Info rows preserved. "Manage account" becomes a clear secondary button at the bottom (still no-op `onPress` until the account flow exists).

- [ ] **Step 1: Replace the file contents**

Replace `mobile/app/(tabs)/profile.tsx` with:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Button } from '@/components/Button';
import { colors, space, type } from '@/lib/theme';

export default function ProfileScreen() {
  return (
    <ScreenLayout
      title="Profile"
      subtitle="Your taste profile gets sharper the more you visit."
    >
      <View style={styles.rows}>
        <InfoRow label="Signed in as" value="Guest" />
        <InfoRow label="Visits logged" value="0" />
        <InfoRow label="Taste profile" value="Not yet trained" />
      </View>
      <View style={styles.buttonWrap}>
        <Button label="Manage account" variant="secondary" />
      </View>
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
  rows: {
    marginTop: space.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: space.md,
    borderTopWidth: 1,
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
  buttonWrap: {
    marginTop: space.lg,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/profile.tsx
git commit -m "ui: rebuild Profile screen on ScreenLayout + Button

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Update tab bar styling (light, drop absolute positioning)

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

**Why:** White background, hairline top border, drop `position: 'absolute'` (no longer needed now that screens own their full vertical space via `ScreenLayout`).

- [ ] **Step 1: Replace the file contents**

Replace `mobile/app/(tabs)/_layout.tsx` with:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          height: Platform.select({ ios: 84, default: 68 }),
          paddingTop: 10,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/_layout.tsx
git commit -m "ui: light tab bar with hairline top border (drop absolute positioning)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Switch root layout `StatusBar` to dark content

**Files:**
- Modify: `mobile/app/_layout.tsx`

**Why:** Light background needs dark status-bar content (clock, battery icons) so they're visible.

- [ ] **Step 1: Replace the file contents**

Replace `mobile/app/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "ui: dark status-bar content for the light background

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Delete `HeroScreen` component

**Files:**
- Delete: `mobile/components/HeroScreen.tsx`

**Why:** No screen imports it after Tasks 7–9. Verify with a grep, then delete.

- [ ] **Step 1: Verify nothing imports HeroScreen**

Run: `cd mobile && grep -RIn "HeroScreen" . --include='*.ts' --include='*.tsx' --exclude-dir=node_modules`
Expected: only `mobile/components/HeroScreen.tsx` itself appears in the output (its own filename / self-references). If any `import { HeroScreen }` line shows up in another file, STOP — go fix that file before deleting. (The expected output may simply be empty if grep doesn't match the filename itself; that's also fine.)

- [ ] **Step 2: Delete the file**

Run: `rm mobile/components/HeroScreen.tsx`

- [ ] **Step 3: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -u mobile/components/HeroScreen.tsx
git commit -m "ui: delete HeroScreen (no consumers after the screen rebuilds)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

(`git add -u` stages the deletion. If `expo-linear-gradient` shows up as a now-unused import warning elsewhere, ignore — the package stays in `package.json` per the spec.)

---

## Task 13: Remove deprecated theme keys

**Files:**
- Modify: `mobile/lib/theme.ts`

**Why:** Safety check. After Tasks 4–11 nothing should reference `textOnDark*`, `black`, `white`, `cta`, or `heroImages`. Removing them confirms the migration is complete — if anything still uses them, typecheck will fail and that file needs to be migrated.

- [ ] **Step 1: Replace `mobile/lib/theme.ts` with the clean version**

```ts
export const colors = {
  // Surfaces
  bg: '#ffffff',
  surface: '#f5f5f7',
  surfaceAlt: '#fafafa',

  // Text
  text: '#0a0a0a',
  textMuted: '#525252',
  textFaint: '#a3a3a3',

  // Lines
  hairline: '#e5e5e5',

  // Buttons
  primaryBg: '#0a0a0a',
  primaryText: '#ffffff',
  primaryBgDisabled: '#e5e5e5',
  primaryTextDisabled: '#a3a3a3',
  secondaryBorder: '#0a0a0a',
  secondaryText: '#0a0a0a',

  // Status
  error: '#dc2626',

  // Tab bar
  tabBarBg: '#ffffff',
  tabActive: '#0a0a0a',
  tabInactive: '#a3a3a3',

  // Dev-only HealthCheck dots
  devChipOkBg: 'rgba(34, 197, 94, 0.85)',
  devChipErrBg: 'rgba(239, 68, 68, 0.85)',
  devChipLoadingBg: '#e5e5e5',
} as const;

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  subtitle: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  inputLabel: { fontSize: 13, fontWeight: '600' as const },
  input: { fontSize: 17, fontWeight: '400' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  name: { fontSize: 17, fontWeight: '600' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;
```

(Notice `heroImages` is gone entirely.)

- [ ] **Step 2: Verify typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

If you see errors like `Property 'textOnDark' does not exist on type ...` or `Cannot find name 'heroImages'`, a file was missed in Tasks 4–11. Locate it (`grep -RIn 'textOnDark\|heroImages\|colors\.black\|colors\.white\|type\.cta' mobile --include='*.ts' --include='*.tsx' --exclude-dir=node_modules`) and migrate it inline. Don't restore the deprecated keys — fix the consumer instead.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/theme.ts
git commit -m "ui: remove deprecated theme keys (textOnDark*, cta, heroImages)

Migration safety check: typecheck passing confirms every consumer was
migrated to the new palette in Tasks 4-11.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Final verification — typecheck, backend sanity, manual iPhone smoke

**Files:** none (verification only)

**Why:** Catch anything missed before pushing the branch.

- [ ] **Step 1: Full mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 2: Backend sanity (no Phase 2 regression)**

Run: `cd backend && pytest -q`
Expected: 29 tests pass. If anything failed, investigate — this plan should not have touched backend code.

- [ ] **Step 3: Start the dev environment**

Start Postgres + Redis if not already running:
```bash
docker compose up -d postgres redis
```

Start the backend (in one terminal):
```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Start Metro (in another terminal):
```bash
cd mobile && npx expo start --clear
```

Scan the QR code with Expo Go on the iPhone (the device must be on the same Wi-Fi as the Mac; `mobile/.env` should already have `EXPO_PUBLIC_API_URL=http://10.0.0.61:8000` — confirm or update with the current Mac LAN IP via `ipconfig getifaddr en0`).

- [ ] **Step 4: Smoke checklist on iPhone**

Tick each item:

- [ ] App opens to Search tab on a **white** background. No hero image. No Metro warnings about missing images.
- [ ] Header reads "Find a restaurant" with the subtitle "Personalized for your taste, mood, and history." underneath. The API health chip is visible in the top-right (dev build).
- [ ] Tap the input. The keyboard opens. The **input remains fully visible above the keyboard at every keystroke.**
- [ ] Type `cozy ramen near me`. The "Search" button is fully black (active state). With the keyboard still open, tap "Search" — the request fires on the **first tap** (it should not just dismiss the keyboard).
- [ ] Results render below the button: a row of filter chips (light grey, dark text) followed by restaurant cards (light grey background, dark name, muted meta line, faint address).
- [ ] Clear the input. The "Search" button becomes greyed out (`primaryBgDisabled` background, `primaryTextDisabled` text). Tapping it does nothing.
- [ ] Switch to the History tab. White background, "Your visits" header, "No visits yet" empty state centered below.
- [ ] Switch to the Profile tab. Three info rows separated by hairlines; "Manage account" button at the bottom is a **secondary** button (white bg, black border, black text). Tapping it is a no-op (expected).
- [ ] Tab bar at the bottom is **white** with a hairline border at the top; the active tab icon is solid black, inactive tab icons are grey.
- [ ] Status bar (top of screen — clock, battery, signal) renders with **dark** content, not white.

If anything in the checklist fails, fix it inline (small commit per fix), re-run the affected smoke item.

- [ ] **Step 5: Push the branch**

Run:
```bash
git push origin phase-2-core-search
```

This adds all the UI-overhaul commits to PR #2.

- [ ] **Step 6: Verify PR #2 picked up the commits**

Run: `gh pr view 2 --json commits --jq '.commits[-5:] | .[] | .messageHeadline'`
Expected: the most recent commit headlines listed are this plan's commits (e.g., "ui: remove deprecated theme keys (textOnDark*, cta, heroImages)" near the top).

---

## Notes for the controller (subagent-driven mode)

- Tasks 1–13 are mechanical when given full task text. Each can run on the cheap/fast model (sonnet 4.6 or haiku 4.5).
- Tasks 7 and 9 touch more files conceptually (screen + multiple imports) but the spec is precise; sonnet 4.6 is sufficient.
- Task 14 is the only judgment task — manual UI smoke testing on a physical device. This is the human owner's verification step; the implementer agent can prepare the dev environment (Step 3) but cannot tick the smoke items off (Step 4). The controller should hand this task back to the human after Step 3.
- Two-stage review per task (spec-compliance reviewer + code-quality reviewer) is appropriate for tasks 1–13. Task 14 needs neither — it's verification.

## Spec coverage check

| Spec requirement | Implementing task(s) |
|---|---|
| Light palette in `theme.ts` | 1, 13 |
| Type scale with `display`, `subtitle`, `inputLabel`, `input`, `button`, `body`, `meta`, `label` | 1 |
| `name` typography (used by ResultsList card) | 1, 5 |
| `ScreenLayout` component | 3 |
| `Button` component with primary/secondary/disabled/loading | 2 |
| Search screen rebuilt, top-anchored, KeyboardAvoidingView | 7 |
| Drop "Learn more" CTA | 7 |
| History screen rebuilt | 8 |
| Profile screen rebuilt + secondary "Manage account" button | 9 |
| FilterChips restyle (drop `chipBg` workaround) | 4 |
| ResultsList card restyle | 5 |
| HealthCheck restyle + `__DEV__` gate | 6 |
| Light tab bar | 10 |
| `StatusBar style="dark"` | 11 |
| Delete `HeroScreen` | 12 |
| Final manual smoke | 14 |

All 16 spec items map to at least one task. No gaps.
