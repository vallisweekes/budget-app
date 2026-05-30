import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsSection from "@/components/Settings/SettingsSection";
import { useAppTranslation } from "@/hooks";
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
  const { t } = useAppTranslation();

  return (
    <>
      <SettingsSection title={t("settings.plans.yourPlans")} right={<Text style={styles.muted}>{t("settings.plans.count", { count: plans.length })}</Text>}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isSubPlan = plan.kind !== "personal";
          const switching = switchingPlanId === plan.id;
          const deleting = deletingPlanId === plan.id;
          const kindLabel = plan.kind === "holiday"
            ? t("settings.plans.kind.holiday")
            : plan.kind === "carnival"
              ? t("settings.plans.kind.carnival")
              : String(plan.kind).replace("_", " ");
          return (
            <View key={plan.id} style={[styles.planRow, isCurrent ? styles.planRowCurrent : null]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planSub}>{kindLabel}{isCurrent ? ` · ${t("settings.plans.current")}` : ""}</Text>
              </View>
              <Pressable
                onPress={() => onSwitchPlan(plan.id)}
                style={[styles.outlineBtn, isCurrent ? styles.outlineBtnCurrent : null]}
                disabled={isCurrent || switching}
              >
                <Text style={[styles.outlineBtnText, isCurrent ? styles.outlineBtnTextCurrent : null]}>{isCurrent ? t("settings.plans.current") : switching ? "..." : t("settings.plans.manage")}</Text>
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

      <SettingsSection title={t("settings.plans.addAnother")}>
        <Pressable onPress={onCreateHoliday} style={styles.primaryGhostBtn}>
          <Text style={styles.primaryGhostText}>{t("settings.plans.createHoliday")}</Text>
        </Pressable>
        <Pressable onPress={onCreateCarnival} style={styles.primaryGhostBtn}>
          <Text style={styles.primaryGhostText}>{t("settings.plans.createCarnival")}</Text>
        </Pressable>
      </SettingsSection>
    </>
  );
}
