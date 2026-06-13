# Fork — Mobile

Expo (React Native + TypeScript) app. Search / For you / Discover modes,
Supabase auth, visit logging, and a live profile with editable preferences.

## Prerequisites

- Node.js 18+ and npm
- For iOS: Xcode (macOS) and a simulator, or the Expo Go app on a device
- For Android: Android Studio + emulator, or Expo Go on a device

## Install & run

```bash
cd mobile
npm install
cp .env.example .env   # set API + Supabase env vars
npm start              # press i / a / w for iOS / Android / web
```

## Environment

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Backend base URL (default `http://localhost:8000`; use your LAN IP on a physical device) |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth. Leave empty for a guest-only build — search still works; History/Profile show a sign-in prompt |
| `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` | Optional analytics (events drop silently when unset) |

Only the Supabase **anon** key ships in the app. All Google/Anthropic/Yelp
calls happen on the backend.

## Auth

`lib/auth.tsx` provides an `AuthProvider` (session restore from AsyncStorage,
auto token refresh tied to app focus) and `useAuth()`. `lib/api.ts` attaches
the Supabase access token to every backend call, which unlocks
personalization. Sign-in/up screens live under `app/auth/`.

## Typecheck

```bash
npm run typecheck
```

## Project layout

```
app/
  _layout.tsx           Root stack + AuthProvider
  (tabs)/
    index.tsx           Search / For you / Discover (mood + dietary chips)
    history.tsx         Visit history (paginated, pull-to-refresh, delete)
    profile.tsx         Live profile + editable preferences + manage account
  auth/sign-in.tsx      Email/password sign-in (modal)
  auth/sign-up.tsx      Account creation (modal)
  log-visit.tsx         Log-a-visit form (modal, opened from a restaurant)
  restaurant/[placeId]  Detail: photos, why-it-matches, popular dishes, log visit
components/             ScreenLayout, Button, Chip, FormField, ResultsList, …
lib/
  api.ts                fetch wrapper (auth header, JSON helpers)
  auth.tsx              Supabase auth context
  supabase.ts           Supabase client (null when unconfigured)
  search.ts visits.ts profile.ts recommendations.ts analytics.ts location.ts
```
