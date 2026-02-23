import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { T } from "@/lib/theme";

type Mode = "login" | "register";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();

  const handleSubmit = async () => {
    if (!username.trim()) {
      Alert.alert("Username required", "Please enter your username.");
      return;
    }
    if (!baseUrl) {
      Alert.alert("Setup incomplete", "EXPO_PUBLIC_API_BASE_URL is not set in your .env file.");
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), mode);
    } catch (err: unknown) {
      Alert.alert(
        mode === "register" ? "Registration failed" : "Sign in failed",
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / App name */}
          <View style={styles.logoArea}>
            <Text style={styles.appName}>Budget App</Text>
            <Text style={styles.tagline}>Track. Plan. Save.</Text>
          </View>

          <View style={styles.card}>
            {/* Mode toggle */}
            <View style={styles.modeRow}>
              {(["login", "register"] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                    {m === "login" ? "Sign In" : "Register"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={T.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              editable={!loading}
            />

            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </Pressable>

            {baseUrl ? (
              <Text style={styles.apiNote}>API: {baseUrl}</Text>
            ) : (
              <Text style={[styles.apiNote, styles.apiNoteError]}>
                ⚠ Set EXPO_PUBLIC_API_BASE_URL in .env
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },

  logoArea: { alignItems: "center", marginBottom: 36 },
  appName: { color: T.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  tagline: { color: T.textDim, fontSize: 14, marginTop: 6, fontWeight: "600" },

  card: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },

  modeRow: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: T.cardAlt,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: T.accent },
  modeBtnText: { color: T.textDim, fontWeight: "800", fontSize: 14 },
  modeBtnTextActive: { color: T.onAccent },

  input: {
    backgroundColor: T.cardAlt,
    color: T.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },

  submitBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: T.onAccent, fontWeight: "700", fontSize: 16 },

  apiNote: {
    marginTop: 16,
    color: T.textDim,
    fontSize: 11,
    textAlign: "center",
  },
  apiNoteError: { color: T.orange },
});
