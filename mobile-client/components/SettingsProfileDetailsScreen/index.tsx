import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useUpdateProfileMutation } from "@/store/api";
import { T } from "@/lib/theme";
import { useTopHeaderOffset } from "@/hooks";
import { styles } from "@/components/SettingsProfileDetailsScreen/style";
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