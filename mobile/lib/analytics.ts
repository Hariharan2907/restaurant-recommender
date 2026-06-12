/**
 * Minimal PostHog integration point (fire-and-forget HTTP capture, no SDK).
 * No-ops unless EXPO_PUBLIC_POSTHOG_KEY is set. Swap for posthog-react-native
 * if session replay / feature flags are ever needed.
 */
import { supabase } from '@/lib/supabase';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let anonId: string | null = null;

async function distinctId(): Promise<string> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const sub = data.session?.user?.id;
    if (sub) return sub;
  }
  if (!anonId) {
    anonId = `anon-${Math.random().toString(36).slice(2)}`;
  }
  return anonId;
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (!KEY) return;
  void (async () => {
    try {
      await fetch(`${HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: KEY,
          event,
          distinct_id: await distinctId(),
          properties: { ...properties, source: 'fork-mobile' },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // analytics must never break the app
    }
  })();
}
