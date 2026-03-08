import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useUpdateProfileMutation } from "@/store/api";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import type { RootStackScreenProps } from "@/navigation/types";

export default function SettingsProfileDetailsScreen({ navigation, route }: RootStackScreenProps<"SettingsProfileDetails">) {
  const topHeaderOffset = useTopHeaderOffset(8);
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [username] = useState(route.params?.username ?? "");
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();

  const save = async () => {
    try {
      await updateProfile({ email: email.trim() || null }).unwrap();
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Could not save details", err instanceof Error ? err.message : "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: topHeaderOffset }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput value={username} editable={false} style={styles.inputDisabled} />

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "800" },
  headerSpacer: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  card: {
    ...cardBase,
    padding: 16,
  },
  label: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    color: T.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 18,
  },
  inputDisabled: {
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    color: T.textMuted,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 18,
  },
  footer: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: `${T.bg}F2`,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: T.card,
  },
  cancelBtnText: { color: T.textMuted, fontSize: 14, fontWeight: "800" },
  saveBtn: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: T.accent,
  },
  saveBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});