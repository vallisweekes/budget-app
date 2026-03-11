import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useEmailVerificationGate } from "@/navigation/EmailVerificationGateContext";
import { useResendEmailVerificationMutation } from "@/store/api";
import { T } from "@/lib/theme";

export default function VerifyEmailRoute() {
  const { signOut } = useAuth();
  const verification = useEmailVerificationGate();
  const [resendEmailVerification, { isLoading }] = useResendEmailVerificationMutation();

  const deadlineLabel = React.useMemo(() => {
    const raw = verification.profile?.emailVerificationDeadlineAt;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [verification.profile?.emailVerificationDeadlineAt]);

  const resend = async () => {
    try {
      await resendEmailVerification().unwrap();
      await verification.refresh();
      Alert.alert("Verification sent", "Check your email for a fresh verification link.");
    } catch (error: unknown) {
      Alert.alert("Could not resend", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
        <View style={{ backgroundColor: T.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: T.border }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: T.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <Ionicons name="mail-unread-outline" size={26} color={T.accent} />
          </View>
          <Text style={{ color: T.text, fontSize: 24, fontWeight: "800" }}>Verify your email to continue</Text>
          <Text style={{ color: T.textDim, fontSize: 15, lineHeight: 22, marginTop: 10 }}>
            Your account setup is complete, but app access is paused until you verify the email linked to this account.
          </Text>
          {verification.profile?.email ? (
            <Text style={{ color: T.text, fontSize: 15, fontWeight: "700", marginTop: 14 }}>{verification.profile.email}</Text>
          ) : null}
          {deadlineLabel ? (
            <Text style={{ color: T.orange, fontSize: 13, fontWeight: "700", marginTop: 10 }}>Verification deadline: {deadlineLabel}</Text>
          ) : null}

          <Pressable onPress={resend} disabled={isLoading} style={{ marginTop: 20, backgroundColor: T.accent, borderRadius: 16, paddingVertical: 15, alignItems: "center", opacity: isLoading ? 0.7 : 1 }}>
            <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 15 }}>{isLoading ? "Sending…" : "Resend verification email"}</Text>
          </Pressable>

          <Pressable onPress={() => { void verification.refresh(); }} style={{ marginTop: 12, borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: T.border }}>
            <Text style={{ color: T.text, fontWeight: "700", fontSize: 15 }}>I have verified</Text>
          </Pressable>

          <Pressable onPress={() => { void signOut(); }} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: T.textDim, fontWeight: "700", fontSize: 14 }}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}