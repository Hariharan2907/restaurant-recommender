# Restaurant Recommender — Mobile

Expo (React Native + TypeScript) app for the Restaurant Recommender. Phase 1: tab scaffolding plus a backend health check.

## Prerequisites

- Node.js 18+ and npm
- For iOS: Xcode (macOS) and a simulator, or the Expo Go app on a device
- For Android: Android Studio + emulator, or Expo Go on a device

## Install

```bash
cd mobile
npm install
```

## Run

```bash
npm start          # opens the Expo dev server (default port 8081)
# then press:
#   i  -> open iOS simulator
#   a  -> open Android emulator
#   w  -> open in web browser
```

Or jump straight to a platform:

```bash
npm run ios
npm run android
npm run web
```

## Backend

The app expects the FastAPI backend at `http://localhost:8000`. Start it before launching the app or the Search tab will show `Backend: unreachable`.

`EXPO_PUBLIC_API_URL` overrides the base URL. It defaults to `http://localhost:8000`. Copy `.env.example` to `.env` to customize:

```bash
cp .env.example .env
```

Note: when running on a physical device, `localhost` resolves to the device itself. Use your machine's LAN IP (e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.42:8000`).

## Typecheck

```bash
npm run typecheck
```

## Project layout

```
app/
  _layout.tsx           Root Stack
  (tabs)/
    _layout.tsx         Tab navigator (Search / History / Profile)
    index.tsx           Search tab
    history.tsx         History tab
    profile.tsx         Profile tab
  +not-found.tsx        404
components/
  HealthCheck.tsx       Pings backend /health and renders a status pill
lib/
  api.ts                fetch wrapper around EXPO_PUBLIC_API_URL
```
