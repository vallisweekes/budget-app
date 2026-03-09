import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch } from "@/lib/api";
import { STRATEGY_OPTIONS } from "@/lib/constants";
import { T } from "@/lib/theme";
import { styles } from "@/components/SettingsStrategyScreen/style";
import { useAuth } from "@/context/AuthContext";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTopHeaderOffset } from "@/hooks";

export default function SettingsStrategyScreen({ navigation, route }: RootStackScreenProps<"SettingsStrategy">) {
  const { budgetPlanId, strategy } = route.params;
  const { signOut } = useAuth();
  const topHeaderOffset = useTopHeaderOffset(8);
  const [draft, setDraft] = useState(strategy ?? "payYourselfFirst");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => STRATEGY_OPTIONS.find((opt) => opt.value === draft), [draft]);

  const save = async () => {
    try {
      setSaving(true);
      await apiFetch("/api/bff/settings", {
        method: "PATCH",
        body: {
          budgetPlanId,
          budgetStrategy: draft,
        },
      });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert("Could not save strategy", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: topHeaderOffset }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <Pressable onPress={signOut} style={styles.headerLogoutBtn}>
          <Ionicons name="log-out-outline" size={16} color={T.red} />
          <Text style={styles.headerLogoutText}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {STRATEGY_OPTIONS.map((option) => {
          const active = draft === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setDraft(option.value)}
              style={[styles.card, active && styles.cardActive]}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{option.label}</Text>
                {active ? <Ionicons name="checkmark-circle" size={18} color={T.accent} /> : null}
              </View>
              <Text style={styles.cardTip}>{option.tip}</Text>
            </Pressable>
          );
        })}

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Selected tip</Text>
          <Text style={styles.tipText}>{selected?.tip}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save strategy"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
