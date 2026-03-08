import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/legal/privacyPolicy";
import { openSettingsExternalUrl, SETTINGS_WEBSITE_URL } from "@/lib/helpers/settingsOverview";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import type { RootStackScreenProps } from "@/navigation/types";

export default function PrivacyPolicyScreen({ navigation }: RootStackScreenProps<"PrivacyPolicy">) {
  const topHeaderOffset = useTopHeaderOffset(8);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: topHeaderOffset }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.updatedAt}>Last updated: {PRIVACY_POLICY_LAST_UPDATED}</Text>
          <Text style={styles.intro}>{PRIVACY_POLICY_INTRO}</Text>
        </View>

        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body ? <Text style={styles.body}>{section.body}</Text> : null}
            {section.bullets?.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <Pressable style={styles.termsBtn} onPress={() => { void openSettingsExternalUrl(`${SETTINGS_WEBSITE_URL}/terms`); }}>
          <Text style={styles.termsBtnText}>Read Terms of Service</Text>
          <Ionicons name="open-outline" size={16} color={T.onAccent} />
        </Pressable>
      </ScrollView>
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
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  heroCard: {
    ...cardBase,
    padding: 16,
    marginBottom: 12,
  },
  updatedAt: { color: T.textDim, fontSize: 12, fontWeight: "700", marginBottom: 10 },
  intro: { color: T.text, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  sectionCard: {
    ...cardBase,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { color: T.text, fontSize: 17, fontWeight: "800", marginBottom: 10 },
  body: { color: T.textDim, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.accent,
    marginTop: 8,
  },
  bulletText: { flex: 1, color: T.textDim, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  termsBtn: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: T.accent,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  termsBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
});