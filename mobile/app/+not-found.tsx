import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  link: {
    paddingVertical: 12,
  },
  linkText: {
    color: '#2563eb',
    fontSize: 16,
  },
});
