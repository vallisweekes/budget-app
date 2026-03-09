import { Link, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { T } from "@/lib/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.body}>This route does not exist in the mobile app yet.</Text>
        <Link href="/(tabs)/dashboard" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Go to dashboard</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.bg,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: T.text,
    fontSize: 24,
    fontWeight: "800",
  },
  body: {
    color: T.textDim,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  button: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accentBorder,
  },
  buttonText: {
    color: T.onAccent,
    fontSize: 14,
    fontWeight: "800",
  },
});