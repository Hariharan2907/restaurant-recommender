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
import { EmptyState, Notice } from "@/components/Feedback";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useAuth } from "@/lib/auth";
import { colors, space, type } from "@/lib/theme";

export default function SignUpScreen() {
  const { signUp, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (busy || !configured || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const err = await signUp(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <ScreenLayout
        scroll
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${email.trim()}. Confirm, then sign in.`}
      >
        <EmptyState
          icon="mail-outline"
          title="Almost there."
          description={`Open the confirmation email we sent to ${email.trim()}, then come back to sign in.`}
        >
          <Button
            label="Back to sign in"
            onPress={() => router.replace("/auth/sign-in")}
          />
        </EmptyState>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      scroll
      title="Create account"
      subtitle="A few good meals. A world of better recommendations."
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
          placeholder="at least 8 characters"
          secureTextEntry
          autoComplete="new-password"
        />
        <FormField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="repeat password"
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={onSubmit}
        />
        {error && <Notice error>{error}</Notice>}
        <Button
          label={busy ? "Creating account…" : "Create account"}
          loading={busy}
          disabled={!configured || !email.trim() || !password || !confirm}
          onPress={onSubmit}
        />
        <Pressable
          onPress={() => router.replace("/auth/sign-in")}
          style={{ minHeight: 44, justifyContent: "center" }}
          accessibilityRole="link"
          hitSlop={8}
        >
          <Text style={styles.switchLink}>
            Already have an account?{" "}
            <Text style={styles.switchLinkAccent}>Sign in</Text>
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
