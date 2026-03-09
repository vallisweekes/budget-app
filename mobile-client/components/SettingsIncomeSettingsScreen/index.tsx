import React from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "@/components/SettingsIncomeSettingsScreen/style";
import MoneyInput from "@/components/Shared/MoneyInput";
import { INCOME_SOURCE_OPTIONS } from "@/lib/constants";
import { useSettingsIncomeSettingsScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import type { RootStackScreenProps } from "@/navigation/types";

export default function SettingsIncomeSettingsScreen({ navigation }: RootStackScreenProps<"SettingsIncomeSettings">) {
  const controller = useSettingsIncomeSettingsScreenController(navigation);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: controller.topHeaderOffset }]}> 
        <Pressable onPress={controller.goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Income settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Primary income</Text>
          <Text style={styles.heroTitle}>Manage the income source your plan should follow first.</Text>
          <Text style={styles.heroText}>
            Changes here update the main income amount and can push that change through the remaining periods in the plan.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Current primary income</Text>
          <Text style={styles.previewTitle}>{controller.activeSource.label}</Text>
          <Text style={styles.previewAmount}>{controller.currentSummaryText}</Text>
          <Text style={styles.previewText}>
            {controller.detectedSourceCount > 1
              ? `Detected from ${controller.detectedSourceCount} income sources in the current period. Salary is selected first when it exists.`
              : "Detected from the current income setup for this plan."}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary income source</Text>
          {INCOME_SOURCE_OPTIONS.map((option) => {
            const active = option.id === controller.selectedSource;
            return (
              <Pressable
                key={option.id}
                onPress={() => controller.selectSource(option.id)}
                style={[styles.optionCard, active && styles.optionCardActive]}
              >
                <View style={[styles.optionIconWrap, active && styles.optionIconWrapActive]}>
                  <Ionicons name={option.icon} size={18} color={active ? T.accent : T.textDim} />
                </View>
                <View style={styles.optionBody}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{option.label}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={18} color={T.accent} /> : null}
                  </View>
                  <Text style={styles.optionDetail}>{option.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.editorCard}>
          <Text style={styles.editorTitle}>Primary income amount</Text>
          <Text style={styles.editorText}>
            {controller.selectedSource === "salary"
              ? "Salary is kept as the primary income row here, so salary updates will carry across future periods when the switches below are on."
              : "Use this amount for the selected primary source. The update will use that same source name when it is distributed forward."}
          </Text>

          <MoneyInput
            currency={controller.settings?.currency ?? "GBP"}
            value={controller.primaryIncomeAmount}
            onChangeValue={controller.setPrimaryIncomeAmount}
            variant="light"
            placeholder="0.00"
          />

          <View style={styles.switchCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Update remaining periods this year</Text>
                <Text style={styles.switchHint}>Apply the new amount from this period through the rest of the year.</Text>
              </View>
              <Switch
                value={controller.applyFullYear}
                onValueChange={controller.setApplyFullYear}
                trackColor={{ false: T.border, true: T.accentFaint }}
                thumbColor={controller.applyFullYear ? T.accent : T.card}
              />
            </View>

            <View style={styles.switchDivider} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Keep that amount across the plan horizon</Text>
                <Text style={styles.switchHint}>Future periods after this year will carry the updated primary income too.</Text>
              </View>
              <Switch
                value={controller.applyHorizon}
                onValueChange={controller.setApplyHorizon}
                trackColor={{ false: T.border, true: T.accentFaint }}
                thumbColor={controller.applyHorizon ? T.accent : T.card}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={controller.goBack}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!controller.isDirty || controller.saving || controller.loading) && styles.disabled]}
          onPress={controller.save}
          disabled={!controller.isDirty || controller.saving || controller.loading}
        >
          <Text style={styles.saveBtnText}>{controller.saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}