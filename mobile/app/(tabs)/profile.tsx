import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { EmptyState, Notice, ResultsSkeleton } from "@/components/Feedback";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { FormField } from "@/components/FormField";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useAuth } from "@/lib/auth";
import {
  deleteAccount,
  getMe,
  updateMe,
  type UserProfile,
} from "@/lib/profile";
import { colors, space, type } from "@/lib/theme";

const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten_free"] as const;
const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
];

export default function ProfileScreen() {
  const { session, loading: authLoading, signOut, configured } = useAuth();

  if (!session) {
    return (
      <ScreenLayout
        scroll
        title="A taste for the good things"
        subtitle="Your favorites, your preferences, your kind of place."
      >
        {authLoading ? (
          <ResultsSkeleton />
        ) : (
          <EmptyState
            icon="finger-print-outline"
            title="Good taste. Uniquely yours."
            description={
              configured
                ? "Tell us what you love, keep track of memorable meals, and discover more places that feel like you."
                : "Personal taste profiles will be available when accounts are enabled. You can still find a great place to eat."
            }
          >
            {configured && (
              <>
                <Button
                  label="Sign in"
                  onPress={() => router.push("/auth/sign-in")}
                />
                <Button
                  label="Create your taste profile"
                  variant="secondary"
                  onPress={() => router.push("/auth/sign-up")}
                />
              </>
            )}
            <Button
              label="Keep exploring"
              variant="secondary"
              onPress={() => router.navigate("/")}
            />
          </EmptyState>
        )}
      </ScreenLayout>
    );
  }

  return <SignedInProfile onSignOut={signOut} />;
}

function SignedInProfile({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Draft form state
  const [displayName, setDisplayName] = useState("");
  const [dietary, setDietary] = useState<string[]>([]);
  const [radius, setRadius] = useState(3000);
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    getMe()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setDisplayName(p.display_name ?? "");
        setDietary(p.dietary_preferences);
        setRadius(p.default_radius_m);
        setLikes(p.cuisine_likes.join(", "));
        setDislikes(p.cuisine_dislikes.join(", "));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const toggleDietary = (option: string) => {
    setDietary((current) =>
      current.includes(option)
        ? current.filter((d) => d !== option)
        : [...current, option],
    );
  };

  const parseCsv = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateMe({
        display_name: displayName.trim(),
        dietary_preferences: dietary,
        default_radius_m: radius,
        cuisine_likes: parseCsv(likes),
        cuisine_dislikes: parseCsv(dislikes),
      });
      setProfile(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await onSignOut();
      setConfirmDelete(false);
    } catch {
      setDeleteError("We couldn’t delete your account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenLayout
      scroll
      title="Your taste, thoughtfully curated"
      subtitle="A few small details make for much better recommendations."
    >
      {profile === null ? (
        error ? (
          <Notice error>{error}</Notice>
        ) : (
          <ResultsSkeleton />
        )
      ) : (
        <View style={styles.scroll}>
          <View style={styles.rows}>
            <InfoRow
              label="Signed in as"
              value={profile.display_name || profile.email}
              first
            />
            <InfoRow
              label="Visits logged"
              value={String(profile.visits_count)}
            />
            <InfoRow
              label="Taste profile"
              value={
                profile.taste_profile_trained
                  ? "Learning from your visits"
                  : "Ready for your first visits"
              }
            />
          </View>

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            What makes a great meal?
          </Text>
          <FormField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we greet you?"
          />

          <View style={styles.chipSection}>
            <Text style={styles.chipLabel}>Dietary requests</Text>
            <View style={styles.chipRow}>
              {DIETARY_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option.replace("_", "-")}
                  selected={dietary.includes(option)}
                  onPress={() => toggleDietary(option)}
                />
              ))}
            </View>
          </View>

          <View style={styles.chipSection}>
            <Text style={styles.chipLabel}>Default search radius</Text>
            <View style={styles.chipRow}>
              {RADIUS_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={radius === option.value}
                  onPress={() => setRadius(option.value)}
                />
              ))}
            </View>
          </View>

          <FormField
            label="Cuisines you love (comma-separated)"
            value={likes}
            onChangeText={setLikes}
            placeholder="thai, ramen, pizza"
            autoCapitalize="none"
          />
          <FormField
            label="Cuisines to avoid"
            value={dislikes}
            onChangeText={setDislikes}
            placeholder="fast food"
            autoCapitalize="none"
          />

          {error && <Notice error>{error}</Notice>}
          {saved && (
            <Notice>
              Your preferences are saved. Here’s to your next great meal.
            </Notice>
          )}
          <Button
            label={saving ? "Saving…" : "Save preferences"}
            loading={saving}
            onPress={onSave}
          />

          <Text style={styles.sectionTitle}>Manage account</Text>
          <View style={styles.accountButtons}>
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => {
                void onSignOut().catch(() =>
                  setError("We couldn’t sign you out. Please try again."),
                );
              }}
            />
            <Button
              label="Delete account"
              variant="secondary"
              onPress={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
            />
          </View>
        </View>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete your account?"
        description="This permanently removes your profile, preferences, and visit history. This action cannot be undone."
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDeleteAccount}
        busy={deleting}
        error={deleteError}
        confirmLabel="Delete account"
        busyLabel="Deleting…"
        cancelLabel="Keep my account"
      />
    </ScreenLayout>
  );
}

function InfoRow({
  label,
  value,
  first = false,
}: {
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.row, first && styles.rowFirst]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  rows: {
    marginBottom: space.sm,
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    flexWrap: "wrap",
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  rowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  rowLabel: {
    ...type.label,
    color: colors.textMuted,
  },
  rowValue: {
    ...type.body,
    flexShrink: 1,
    color: colors.text,
    fontWeight: "500",
  },
  sectionTitle: {
    ...type.heading,
    color: colors.text,
    marginTop: space.lg,
  },
  chipSection: {
    gap: space.xs,
  },
  chipLabel: {
    ...type.inputLabel,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  accountButtons: {
    gap: space.sm,
  },
});
