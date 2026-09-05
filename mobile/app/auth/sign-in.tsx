import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { Notice } from "@/components/Feedback";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useAuth } from "@/lib/auth";
import { colors, space, type } from "@/lib/theme";

export default function SignInScreen() {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy || !configured || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.back();
  };

  return (
    <ScreenLayout
      scroll
      title="Welcome back"
      subtitle="Sign in to get recommendations tuned to your taste."
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.form}
      >
        {!configured && (
          <Notice error>
            Accounts are temporarily unavailable. You can still explore
            restaurants as a guest.
          </Notice>
        )}
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          onSubmitEditing={onSubmit}
        />
        {error && <Notice error>{error}</Notice>}
        <Button
          label={busy ? "Signing in…" : "Sign in"}
          loading={busy}
          disabled={!configured || !email.trim() || !password}
          onPress={onSubmit}
        />
        <Pressable
          onPress={() => router.replace("/auth/sign-up")}
          style={{ minHeight: 44, justifyContent: "center" }}
          accessibilityRole="link"
          hitSlop={8}
        >
          <Text style={styles.switchLink}>
            New here?{" "}
            <Text style={styles.switchLinkAccent}>Create an account</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.lg,
    width: "100%",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 20,
    padding: 24,
  },
  switchLink: {
    ...type.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.sm,
  },
  switchLinkAccent: {
    color: colors.accent,
    fontWeight: "600",
  },
});
