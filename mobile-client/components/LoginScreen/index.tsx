import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { styles } from "@/components/LoginScreen/style";
import { useAuth } from "@/context/AuthContext";
import { getApiBaseUrlInfo } from "@/lib/api";
import { T } from "@/lib/theme";
import type { LoginScreenMode } from "@/types";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<LoginScreenMode>("login");
  const [loading, setLoading] = useState(false);

  const apiInfo = (() => {
    try {
      return getApiBaseUrlInfo();
    } catch {
      return null;
    }
  })();

  const baseUrl = apiInfo?.resolvedUrl ?? (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();

  const handleSubmit = async () => {
    if (!username.trim()) {
      Alert.alert("Username required", "Please enter your username.");
      return;
    }
    if (mode === "register" && !email.trim()) {
      Alert.alert("Email required", "Please enter your email to register.");
      return;
    }
    if (!baseUrl) {
      Alert.alert("Setup incomplete", "EXPO_PUBLIC_API_BASE_URL is not set in your .env file.");
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), mode, email.trim());
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
            <Text style={styles.appName}>BudgetIn Check</Text>
            <Text style={styles.tagline}>Track. Plan. Save.</Text>
          </View>

          <View style={styles.card}>
            {/* Mode toggle */}
            <View style={styles.modeRow}>
              {(["login", "register"] as LoginScreenMode[]).map((m) => (
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

            {mode === "register" ? (
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={T.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                editable={!loading}
              />
            ) : null}

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
              <Text style={styles.apiNote}>
                API: {baseUrl}
                {apiInfo?.wasAutoResolved ? " (auto-resolved from Expo dev host)" : ""}
              </Text>
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
