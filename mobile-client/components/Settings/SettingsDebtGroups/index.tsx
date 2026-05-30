import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import type { SettingsDebtGroupsProps } from "@/types/components/settings/SettingsDebtGroups.types";

export default function SettingsDebtGroups({
  groupedDebts,
  currency,
  asMoneyInput,
  onOpenDebtEditor,
}: SettingsDebtGroupsProps) {
  const { t } = useAppTranslation();

  return (
    <>
      {groupedDebts.map((group) => (
        <View key={group.key} style={styles.debtTypeBlock}>
          <View style={styles.debtTypeHead}>
            <View style={styles.debtTypeIconWrap}>
              <Ionicons name={group.icon} size={14} color={T.textDim} />
            </View>
            <Text style={styles.debtTypeTitle}>{group.key === "credit_card" ? t("settings.cards.creditCards") : t("settings.cards.storeCards")}</Text>
            <Text style={styles.debtTypeCount}>{group.items.length}</Text>
          </View>

          {group.items.map((debt) => (
            <Pressable key={debt.id} style={styles.debtCard} onPress={() => onOpenDebtEditor(debt)}>
              <View style={styles.debtCardBody}>
                <Text style={styles.debtName}>{debt.name}</Text>
                <Text style={styles.debtSub}>{debt.type === "store_card" ? t("debts.type.storeCard") : t("debts.type.creditCard")}</Text>
                <Text style={styles.debtSub}>{t("settings.cards.currentBalance", { amount: `${currency}${asMoneyInput(debt.currentBalance) || "0"}` })}</Text>
                {debt.type === "credit_card" ? (
                  <Text style={styles.debtSub}>{t("settings.cards.creditLimit", { amount: `${currency}${asMoneyInput(debt.creditLimit) || "0"}` })}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.textDim} />
            </Pressable>
          ))}
        </View>
      ))}
    </>
  );
}
