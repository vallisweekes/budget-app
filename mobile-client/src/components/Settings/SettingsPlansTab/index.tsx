import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsSection from "@/components/Settings/SettingsSection";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsPlansTabProps } from "@/types/components/settings/SettingsPlansTab.types";

export default function SettingsPlansTab({
  plans,
  currentPlanId,
  switchingPlanId,
  deletingPlanId,
  onSwitchPlan,
  onDeletePlan,
  onCreateHoliday,
  onCreateCarnival,
}: SettingsPlansTabProps) {
  return (
    <>
      <SettingsSection title="Your plans" right={<Text style={styles.muted}>{plans.length} plans</Text>}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isSubPlan = plan.kind !== "personal";
          const switching = switchingPlanId === plan.id;
          const deleting = deletingPlanId === plan.id;
          return (
            <View key={plan.id} style={styles.planRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planSub}>{String(plan.kind).replace("_", " ")}{isCurrent ? " · Current" : ""}</Text>
              </View>
              <Pressable onPress={() => onSwitchPlan(plan.id)} style={styles.outlineBtn} disabled={isCurrent || switching}>
                <Text style={styles.outlineBtnText}>{isCurrent ? "Current" : switching ? "..." : "Manage"}</Text>
              </Pressable>
              {isSubPlan ? (
                <Pressable onPress={() => onDeletePlan(plan)} style={styles.trashBtn} disabled={deleting}>
                  <Ionicons name="trash-outline" size={16} color={T.red} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </SettingsSection>

      <SettingsSection title="Add another plan">
        <Pressable onPress={onCreateHoliday} style={styles.primaryGhostBtn}>
          <Text style={styles.primaryGhostText}>Create Holiday plan</Text>
        </Pressable>
        <Pressable onPress={onCreateCarnival} style={styles.primaryGhostBtn}>
          <Text style={styles.primaryGhostText}>Create Carnival plan</Text>
        </Pressable>
      </SettingsSection>
    </>
  );
}
