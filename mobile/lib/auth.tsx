import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';

type AuthState = {
  /** False when Supabase env vars are missing (guest-only build). */
  configured: boolean;
  /** True until the persisted session has been restored. */
  loading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  configured: false,
  loading: false,
  session: null,
  signIn: async () => 'Auth is not configured.',
  signUp: async () => 'Auth is not configured.',
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, next) => setSession(next),
    );

    // Supabase only refreshes tokens while "started"; tie that to app focus.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });

    return () => {
      subscription.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Auth is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return 'Auth is not configured.';
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        configured: supabase !== null,
        loading,
        session,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
