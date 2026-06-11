import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useResendEmailVerificationMutation, useUpdateProfileMutation } from "@/store/api";
import { T } from "@/lib/theme";
import { useTopHeaderOffset } from "@/hooks";
import { styles } from "@/components/SettingsProfileDetailsScreen/style";
import type { RootStackScreenProps } from "@/navigation/types";

export default function SettingsProfileDetailsScreen({ navigation, route }: RootStackScreenProps<"SettingsProfileDetails">) {
  const topHeaderOffset = useTopHeaderOffset(8);
  const { hydrateProfile, refreshProfile } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [username] = useState(route.params?.username ?? "");
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [resendEmailVerification, { isLoading: resending }] = useResendEmailVerificationMutation();
  const [verificationState, setVerificationState] = useState<{
    status: "verified" | "pending" | "missing_email" | "not_required";
    deadlineAt: string | null;
  }>({
    status: route.params?.emailVerificationStatus ?? "not_required",
    deadlineAt: route.params?.emailVerificationDeadlineAt ?? null,
  });

  const badge = React.useMemo(() => {
    if (verificationState.status === "verified") {
      return { label: "Verified", bg: `${T.green}22`, color: T.green };
    }
    if (verificationState.status === "pending") {
      return { label: "Pending", bg: `${T.orange}22`, color: T.orange };
    }
    if (verificationState.status === "missing_email") {
      return { label: "Missing email", bg: `${T.red}22`, color: T.red };
    }
    return { label: "Not required", bg: `${T.textDim}22`, color: T.textDim };
  }, [verificationState.status]);

  const deadlineLabel = React.useMemo(() => {
    if (!verificationState.deadlineAt) return null;
    const parsed = new Date(verificationState.deadlineAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [verificationState.deadlineAt]);

  const save = async () => {
    try {
      const next = await updateProfile({ email: email.trim() || null }).unwrap();
      hydrateProfile(next);
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Could not save details", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const resend = async () => {
    try {
      const response = await resendEmailVerification().unwrap();
      setVerificationState({
        status: response.status,
        deadlineAt: response.deadlineAt,
      });
      await refreshProfile();
      Alert.alert("Verification sent", "Check your email for a fresh verification link.");
    } catch (err: unknown) {
      Alert.alert("Could not resend", err instanceof Error ? err.message : "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView style={[styles.content, { paddingTop: topHeaderOffset }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />

          <Text style={styles.label}>Username</Text>
          <TextInput value={username} editable={false} style={styles.inputDisabled} />

          <Text style={styles.label}>Email verification</Text>
          <View style={styles.verificationCard}>
            <View pointerEvents="none" style={[styles.cardGlow, styles.verificationGlow]} />
            <View style={[styles.verificationBadge, { backgroundColor: badge.bg, borderColor: `${badge.color}66` }]}> 
              <Text style={[styles.verificationBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            <Text style={styles.verificationTitle}>Verification status</Text>
            <Text style={styles.verificationBody}>
              {verificationState.status === "verified"
                ? "This email is verified for app access."
                : verificationState.status === "pending"
                  ? deadlineLabel
                    ? `Verify this email before ${deadlineLabel} to keep using the app.`
                    : "Verify this email to keep using the app."
                  : verificationState.status === "missing_email"
                    ? "Add an email address, then verify it from the link we send you."
                    : "Verification is not currently required for this account."}
            </Text>
            {verificationState.status !== "verified" ? (
              <Pressable style={styles.verificationButton} onPress={resend} disabled={resending}>
                <Text style={styles.verificationButtonText}>{resending ? "Sending…" : "Resend verification email"}</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
        </View>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}