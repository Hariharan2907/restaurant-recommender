import { router } from "expo-router";
import { ScreenLayout } from "@/components/ScreenLayout";
import { EmptyState } from "@/components/Feedback";
import { Button } from "@/components/Button";
export default function NotFoundScreen() {
  return (
    <ScreenLayout
      scroll
      title="A little off the menu"
      subtitle="This page isn’t on the menu, but there’s plenty more to discover."
    >
      <EmptyState
        icon="compass-outline"
        title="Let’s find your way back."
        description="The link may have changed. Head back to explore and find your next favorite restaurant."
      >
        <Button
          label="Back to discovering"
          onPress={() => router.replace("/")}
        />
      </EmptyState>
    </ScreenLayout>
  );
}
