import Head from "expo-router/head";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { WebStyles } from "@/components/WebStyles";
import { AuthProvider } from "@/lib/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Head>
        <title>Fork — Find your next favorite</title>
      </Head>
      <WebStyles />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/sign-in" options={{ presentation: "modal" }} />
        <Stack.Screen name="auth/sign-up" options={{ presentation: "modal" }} />
        <Stack.Screen name="log-visit" options={{ presentation: "modal" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AuthProvider>
  );
}
