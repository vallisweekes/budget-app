import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "@/components/PrivacyPolicyScreen/style";
import {
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/legal/privacyPolicy";
import { openSettingsExternalUrl, SETTINGS_WEBSITE_URL } from "@/lib/helpers/settingsOverview";
import { useTopHeaderOffset } from "@/hooks";
import { T } from "@/lib/theme";
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