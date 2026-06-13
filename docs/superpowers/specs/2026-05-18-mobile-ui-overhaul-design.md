# Mobile UI Overhaul — Design Spec

**Date:** 2026-05-18
**Branch (planned):** `mobile-ui-overhaul`
**Owner:** Hari
**Status:** Approved (brainstorm)

## Problem

The mobile app inherited from Phase 1/2 has three usability issues:

1. **Decorative-but-distracting hero images.** Every tab uses a full-bleed Unsplash photo with a dark gradient overlay. The user wants a clean, intentional UI instead.
2. **Ambiguous buttons.** The primary CTA is black-on-dark (low contrast). The "Learn more" CTA on Search and "Manage account" CTA on Profile look the same as the primary. Buttons are not clearly affordant.
3. **Keyboard covers the search input.** The current layout anchors content to the bottom of the screen (`justifyContent: 'flex-end'`). When the keyboard opens, it sits over the input — the user cannot see what they're typing.

## Goals

- Replace the dark/photo aesthetic with a light, clean monochrome design.
- Make buttons unambiguously tappable (filled rounded rectangles, full-width on primary actions, disabled state visually distinct).
- Restructure the Search screen so the input lives near the top of the screen, well clear of the keyboard.
- Keep visual consistency across all three tabs (Search, History, Profile).

## Non-goals

- Adding new product features (visit logging, embeddings, ranking) — that is Phase 3 and is unrelated.
- Adding dark-mode support — the new palette is light only. Dark mode can be a future enhancement.
- Restyling the tab-bar icons themselves — only the bar's background/border colors change.
- Localization, accessibility audits beyond touch-target sizing, or animation work.

## Approach

Replace the existing shared layout (`HeroScreen`) with a new minimal `ScreenLayout` component. Replace the dark color palette in `mobile/lib/theme.ts` with a light one in the same shape so existing components keep compiling against the same `colors` import. Extract a reusable `Button` component so all CTAs share styling and disabled/loading behavior. Each tab screen (`index.tsx`, `history.tsx`, `profile.tsx`) is rewritten against the new layout in the same pass.

## Visual Design

### Palette (replaces `mobile/lib/theme.ts` `colors`)

| Key | Value | Use |
|---|---|---|
| `bg` | `#ffffff` | Page background |
| `surface` | `#f5f5f7` | Input fill |
| `surfaceAlt` | `#fafafa` | Result cards, filter chips |
| `text` | `#0a0a0a` | Primary text |
| `textMuted` | `#525252` | Subtitle, meta |
| `textFaint` | `#a3a3a3` | Placeholder, disabled text, address line |
| `hairline` | `#e5e5e5` | Borders |
| `primaryBg` | `#0a0a0a` | Primary button background |
| `primaryText` | `#ffffff` | Primary button label |
| `primaryBgDisabled` | `#e5e5e5` | Primary button disabled background |
| `primaryTextDisabled` | `#a3a3a3` | Primary button disabled label |
| `secondaryBorder` | `#0a0a0a` | Secondary button border |
| `secondaryText` | `#0a0a0a` | Secondary button label |
| `error` | `#dc2626` | Error message text |
| `tabBarBg` | `#ffffff` | Tab bar background |
| `tabActive` | `#0a0a0a` | Active tab icon tint |
| `tabInactive` | `#a3a3a3` | Inactive tab icon tint |
| `devChipOkBg` | `rgba(34, 197, 94, 0.85)` | Dev HealthCheck OK dot (unchanged) |
| `devChipErrBg` | `rgba(239, 68, 68, 0.85)` | Dev HealthCheck error dot (unchanged) |
| `devChipLoadingBg` | `#e5e5e5` | Dev HealthCheck loading dot (lightened for white bg) |

The `textOnDark*` keys from the old palette are removed; nothing references them after the rewrites.

### Type scale (replaces `mobile/lib/theme.ts` `type`)

| Key | Size / line-height | Weight | Letter-spacing | Transform |
|---|---|---|---|---|
| `display` | 28 / 34 | 700 | 0 | — |
| `subtitle` | 15 / 22 | 400 | 0 | — |
| `inputLabel` | 13 | 600 | 0 | — |
| `input` | 17 | 400 | 0 | — |
| `button` | 15 | 600 | 0 | — |
| `body` | 15 / 22 | 400 | 0 | — |
| `meta` | 13 | 500 | 0 | — |
| `label` | 11 | 600 | 1.4 | uppercase |

The `label` key is preserved (used by `HealthCheck`). `cta` is removed; the new `button` style replaces it.

### `heroImages` constant — removed

Nothing imports `heroImages` after the rewrites.

### Spacing — unchanged

`space` (xs:4, sm:8, md:16, lg:24, xl:40, xxl:64) is kept as-is.

## Component Design

### `mobile/components/ScreenLayout.tsx` (new)

```tsx
type Props = {
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  children: ReactNode;
};
```

Renders a `SafeAreaView` from `react-native-safe-area-context` (an Expo SDK 54 dependency already in `package.json` via expo-router) with `edges={['top', 'left', 'right']}` — bottom is owned by the tab bar. Background `bg`. Inside: a header row containing the `title` (styled with `type.display`, color `text`) on the left and `topRight` on the right; an optional `subtitle` line below the title (styled `type.subtitle`, color `textMuted`); then `children` in a content area with horizontal padding `space.lg`.

The content area is a plain `View` — each consumer decides whether to wrap its inner content in a `ScrollView`. `ScreenLayout` adds a `paddingBottom` of `Platform.select({ ios: 84, default: 68 }) + space.md` so children never tuck under the tab bar.

Header padding: `paddingTop: space.md` inside the `SafeAreaView`. Title and `topRight` aligned along the row with `justifyContent: 'space-between'`, `alignItems: 'center'`.

### `mobile/components/Button.tsx` (new)

```tsx
type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};
```

Primary (`variant === 'primary'`, default): `primaryBg` background, `primaryText` label (`type.button`), `borderRadius: 12`, `paddingVertical: 14`, `paddingHorizontal: space.lg`. `alignSelf: 'stretch'` so the button fills the parent's cross-axis width (Search uses it full-width inside the ScrollView; Profile wraps it in a `View` if a narrower button is wanted).

Secondary: white background, 1px `secondaryBorder` border, `secondaryText` label, same radius/padding.

Disabled: when `disabled === true` OR `loading === true`, `onPress` is suppressed. Primary uses `primaryBgDisabled`/`primaryTextDisabled`. Secondary uses `hairline` border + `textFaint` label.

Loading: renders an `ActivityIndicator` inline to the left of the label (label stays visible — e.g., "Searching…").

Press feedback: `Pressable` with `{ pressed }` style applying `opacity: 0.75` when pressed and not disabled.

### Existing components — restyled, logic preserved

#### `mobile/components/FilterChips.tsx`
- Chip background: `surfaceAlt`. Border: 1px `hairline`. Text: 13/500 `text`.
- Drop the `(colors as any).chipBg` workaround — `surfaceAlt` is the real key.
- Logic (which fields produce chips) unchanged.

#### `mobile/components/ResultsList.tsx`
- Card: `surfaceAlt` background, 12px radius, 1px `hairline` border, padding `space.md`.
- Name: 17/600 `text`.
- Meta row: 13/500 `textMuted`, gap `space.sm`.
- Address: 13/400 `textFaint`, marginTop 4.
- Empty state: centered, `textMuted`.
- `FlatList` with `scrollEnabled={false}` — kept, because the screen's own `ScrollView` is the scrolling container.

#### `mobile/components/HealthCheck.tsx`
- Early return: `if (!__DEV__) return null;` at the top of the component body. In production builds the chip never renders.
- Chip background: `#ffffff` with 1px `hairline` border (replaces the `rgba(0,0,0,0.45)` dark pill).
- Label color: `textMuted`. Status dot keeps the green/red.
- The `apiFetch('/health')` effect and three-state machine (`loading` / `ok` / `error`) are unchanged.

### Tab bar (`mobile/app/(tabs)/_layout.tsx`)

`tabBarStyle`:
```ts
{
  backgroundColor: colors.tabBarBg,        // '#ffffff'
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: colors.hairline,
  height: Platform.select({ ios: 84, default: 68 }),
  paddingTop: 10,
  elevation: 0,
}
```

Drop `position: 'absolute'` — that was useful when the screen content needed to bleed under a translucent dark bar. Solid white means standard positioning works, and screens don't need to compensate.

`tabBarActiveTintColor: colors.tabActive` (`#0a0a0a`), `tabBarInactiveTintColor: colors.tabInactive` (`#a3a3a3`). Icons (Ionicons names) are unchanged.

### Root layout (`mobile/app/_layout.tsx`)

`<StatusBar style="dark" />` (was `light`).

## Screen Designs

### Search (`mobile/app/(tabs)/index.tsx`)

Structure:
```tsx
<ScreenLayout
  title="Find a restaurant"
  subtitle="Personalized for your taste, mood, and history."
  topRight={<HealthCheck />}
>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
      {/* Input section */}
      <View>
        <Text style={[type.inputLabel, { color: textMuted }]}>What are you craving?</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          placeholder="cozy ramen near me"
          placeholderTextColor={textFaint}
          returnKeyType="search"
          autoCapitalize="none"
          editable={coords !== null}
          // styled: surface bg, 12px radius, 14px vertical padding, 17px input type
        />
      </View>

      <Button
        label={loading ? 'Searching…' : 'Search'}
        loading={loading}
        disabled={query.trim().length === 0 || coords === null}
        onPress={onSearch}
      />

      {locDenied && <Text style={warning}>Enable location to search nearby.</Text>}
      {error && <Text style={errorStyle}>{error}</Text>}

      {response && (
        <>
          <FilterChips filters={response.parsed_filters} />
          <ResultsList results={response.results} />
        </>
      )}
    </ScrollView>
  </KeyboardAvoidingView>
</ScreenLayout>
```

State (`query`, `coords`, `locDenied`, `loading`, `error`, `response`) and effect logic (`getDeviceLocation` on mount, `search(query, coords)` on submit) are **unchanged** from the current implementation. Only the JSX and styles change.

The "Learn more" button is **removed**.

The input label is sentence case ("What are you craving?") using `type.inputLabel` styling — sentence case is more readable than the small-caps treatment the old design used.

Keyboard handling:
- `KeyboardAvoidingView` adds bottom padding equal to the keyboard height on iOS so the layout shifts up.
- `keyboardShouldPersistTaps="handled"` makes the "Search" button register on the first tap while the keyboard is open (default behavior would dismiss the keyboard first).
- The input sits high in the layout, so even without the avoiding view it would not be covered. The avoiding view is a defensive belt-and-suspenders.

### History (`mobile/app/(tabs)/history.tsx`)

```tsx
<ScreenLayout title="Your visits" subtitle="The places that shape your taste profile.">
  <View style={{ marginTop: space.lg, gap: space.xs, alignItems: 'center' }}>
    <Text style={{ ...type.body, color: colors.text, fontWeight: '600' }}>No visits yet</Text>
    <Text style={{ ...type.body, color: colors.textMuted, maxWidth: 320, textAlign: 'center' }}>
      Log a visit after you eat somewhere new and it will appear here.
    </Text>
  </View>
</ScreenLayout>
```

No CTAs.

### Profile (`mobile/app/(tabs)/profile.tsx`)

```tsx
<ScreenLayout title="Profile" subtitle="Your taste profile gets sharper the more you visit.">
  <InfoRow label="Signed in as" value="Guest" />
  <InfoRow label="Visits logged" value="0" />
  <InfoRow label="Taste profile" value="Not yet trained" />
  <View style={{ marginTop: space.lg }}>
    <Button label="Manage account" variant="secondary" />
  </View>
</ScreenLayout>
```

`InfoRow` is defined inline in `profile.tsx` — a row with `justifyContent: 'space-between'`, top border (1px `hairline`), label (`type.label`, `textMuted`), value (`type.body`, `text`, weight 500).

The "Manage account" button has no `onPress` for now (same as today — placeholder until account flow exists). It is visually clearly a secondary button so users understand it is a real, separate action.

## Data Flow

No backend changes. No new endpoints. No new state. The existing `search()` client (`mobile/lib/search.ts`), location helper (`mobile/lib/location.ts`), and API base (`mobile/lib/api.ts`) are all unchanged. This is a presentation-layer overhaul only.

## Error & Edge Cases

- **Location permission denied:** Existing `locDenied` flag — render warning text under the button, primary button stays disabled (since `coords === null`).
- **Location fetch error:** Existing `error` flag from `getDeviceLocation` — shown in `error` style.
- **Search API error:** Existing `try/catch` around `search(query, coords)` — error text rendered below button.
- **Empty query:** Button disabled (`query.trim().length === 0`).
- **No results:** `ResultsList` empty state ("No spots match. Try widening your search.") already handles this; restyled but same logic.
- **API health chip in production:** Hidden via `__DEV__` check inside `HealthCheck`.
- **Keyboard covering input:** Three defenses — input is in the upper third of the screen, `KeyboardAvoidingView` pads on iOS, `keyboardShouldPersistTaps="handled"` keeps button tappable.

## Testing Strategy

This is a pure UI overhaul with no business-logic changes. Test plan:

1. **Typecheck**: `cd mobile && npx tsc --noEmit` passes. Catches palette-rename mismatches.
2. **Backend tests untouched**: The existing 29 backend tests should still pass (sanity check that nothing on the backend was touched: `cd backend && pytest`).
3. **Manual smoke on iPhone via Expo Go**:
   - All three tabs render on white background, no broken images, no "Image source not found" warnings in Metro.
   - Search: focus the input on iPhone, type — confirm the input remains visible above the keyboard at every keystroke.
   - Tap "Search" while keyboard is up — query fires on the first tap.
   - Run "cozy ramen near me" — chips + result cards render below in the light style.
   - Submit empty query: button is visibly disabled (greyed), no API call.
   - History tab: empty state renders, no images, tab bar visible.
   - Profile tab: three info rows + secondary "Manage account" button. Tapping it is a no-op (expected for this phase).
   - Tab bar: white with hairline top border; switching tabs makes active icon clearly black, inactive grey.
4. **Optional production-build check**: `EXPO_PUBLIC_API_URL=... __DEV__=false ...` confirm the API health chip disappears. (Skipping the chip is also fine if the user is not building for production right now.)

No new unit tests — components are presentational. The search logic that has tests (parse, places, filter, restaurants) is untouched.

## Open Questions

None. All visual and behavioral decisions resolved in brainstorming.

## File Manifest

**New:**
- `mobile/components/ScreenLayout.tsx`
- `mobile/components/Button.tsx`

**Modified:**
- `mobile/lib/theme.ts` (palette + type rewrite, `heroImages` removed)
- `mobile/app/(tabs)/index.tsx` (Search screen rebuild)
- `mobile/app/(tabs)/history.tsx`
- `mobile/app/(tabs)/profile.tsx`
- `mobile/app/(tabs)/_layout.tsx` (light tab bar)
- `mobile/app/_layout.tsx` (`StatusBar style="dark"`)
- `mobile/components/FilterChips.tsx` (light styling)
- `mobile/components/ResultsList.tsx` (light styling)
- `mobile/components/HealthCheck.tsx` (light styling + `__DEV__` gate)

**Deleted:**
- `mobile/components/HeroScreen.tsx`

`expo-linear-gradient` stays in `package.json` to avoid an install cycle even though nothing imports it after this change. It can be pruned in a separate housekeeping commit if desired.
