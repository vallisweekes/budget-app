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
              placeholderTextColor="#4a5568"
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
  safe: { flex: 1, backgroundColor: "#f2f4f7" },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },

  logoArea: { alignItems: "center", marginBottom: 36 },
  appName: { color: "#0f282f", fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  tagline: { color: "rgba(15,40,47,0.55)", fontSize: 14, marginTop: 6, fontWeight: "600" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },

  modeRow: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(15,40,47,0.06)",
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: "#02eff0" },
  modeBtnText: { color: "rgba(15,40,47,0.55)", fontWeight: "800", fontSize: 14 },
  modeBtnTextActive: { color: "#061b1c" },

  input: {
    backgroundColor: "rgba(15,40,47,0.06)",
    color: "#0f282f",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },

  submitBtn: {
    backgroundColor: "#02eff0",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#061b1c", fontWeight: "700", fontSize: 16 },

  apiNote: {
    marginTop: 16,
    color: "rgba(15,40,47,0.55)",
    fontSize: 11,
    textAlign: "center",
  },
  apiNoteError: { color: "#f4a942" },
});
