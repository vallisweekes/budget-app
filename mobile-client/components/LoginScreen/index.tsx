import React, { useEffect, useRef, useState } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { styles } from "@/components/LoginScreen/style";
import { useAuth } from "@/context/AuthContext";
import { getApiBaseUrlInfo } from "@/lib/api";
import { T } from "@/lib/theme";
import type { LoginScreenMode } from "@/types";

export default function LoginScreen() {
  const { prepareRegistration, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [mode, setMode] = useState<LoginScreenMode>("login");
  const [loading, setLoading] = useState(false);
  const usernameLabelProgress = useRef(new Animated.Value(0)).current;
  const emailLabelProgress = useRef(new Animated.Value(0)).current;

  const baseUrl = (() => {
    try {
      return getApiBaseUrlInfo().resolvedUrl ?? (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();
    } catch {
      return (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();
    }
  })();

  useEffect(() => {
    Animated.timing(usernameLabelProgress, {
      toValue: usernameFocused || username.trim().length > 0 ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [username, usernameFocused, usernameLabelProgress]);

  useEffect(() => {
    Animated.timing(emailLabelProgress, {
      toValue: emailFocused || email.trim().length > 0 ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [email, emailFocused, emailLabelProgress]);

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
      if (mode === "register") {
        await prepareRegistration(username.trim(), email.trim());
        return;
      }

      await signIn(username.trim(), "login", email.trim());
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
      <View pointerEvents="none" style={[styles.bgGlow, styles.bgGlowTop]} />
      <View pointerEvents="none" style={[styles.bgGlow, styles.bgGlowBottom]} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoArea}>
            <Text style={styles.appName}>BudgetIn Check</Text>
            <Text style={styles.tagline}>Track. Plan. Save.</Text>
          </View>

          <View style={styles.formWrap}>

            {/* Mode toggle */}
            <View style={styles.modeRow}>
              {(["login", "register"] as LoginScreenMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                  onPress={() => setMode(m)}
                  disabled={loading}
                >
                  <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                    {m === "login" ? "Sign In" : "Register"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.fieldWrap}>
              <Animated.Text
                style={[
                  styles.fieldLabel,
                  {
                    opacity: usernameLabelProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.68, 1],
                    }),
                    transform: [
                      {
                        translateY: usernameLabelProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -10],
                        }),
                      },
                      {
                        scale: usernameLabelProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.84],
                        }),
                      },
                    ],
                  },
                  (usernameFocused || username.trim()) && styles.fieldLabelActive,
                ]}
              >
                Username
              </Animated.Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
                editable={!loading}
              />
            </View>

            {mode === "register" ? (
              <View style={styles.fieldWrap}>
                <Animated.Text
                  style={[
                    styles.fieldLabel,
                    {
                      opacity: emailLabelProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.68, 1],
                      }),
                      transform: [
                        {
                          translateY: emailLabelProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -10],
                          }),
                        },
                        {
                          scale: emailLabelProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0.84],
                          }),
                        },
                      ],
                    },
                    (emailFocused || email.trim()) && styles.fieldLabelActive,
                  ]}
                >
                  Email
                </Animated.Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  returnKeyType="done"
                  editable={!loading}
                />
              </View>
            ) : null}

            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.submitBtnLoadingRow}>
                  <ActivityIndicator color={T.bg} size="small" />
                  <Text style={styles.submitBtnLoadingText}>{mode === "login" ? "Signing in..." : "Creating account..."}</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
