import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsDebtGroups from "@/components/Settings/SettingsDebtGroups";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import { asMoneyInput } from "@/lib/helpers/settings";
import type { SettingsMoneyCardsViewProps } from "@/types/components/settings/SettingsMoneyCardsView.types";

export default function SettingsMoneyCardsView({ currency, creditCardGroups, storeCardGroups, onAddDebt, onOpenDebtEditor }: SettingsMoneyCardsViewProps) {
  return (
    <View style={styles.plainSavingsBlock}>
      <View>
        <View style={styles.plainSectionHeadRow}>
          <Text style={styles.plainBudgetTitle}>Credit cards</Text>
          <Pressable onPress={onAddDebt} style={styles.addCardBtn}>
            <Ionicons name="add" size={16} color={T.onAccent} />
            <Text style={styles.addCardBtnText}>Card</Text>
          </Pressable>
        </View>
        {creditCardGroups.length === 0 ? (
          <Text style={styles.muted}>No credit cards in this plan yet.</Text>
        ) : (
          <SettingsDebtGroups groupedDebts={creditCardGroups} currency={currency} asMoneyInput={asMoneyInput} onOpenDebtEditor={onOpenDebtEditor} />
        )}
      </View>

      <View style={styles.moneySectionCard}>
        <View style={styles.plainSectionHeadRow}>
          <Text style={styles.plainBudgetTitle}>Store cards</Text>
        </View>
        {storeCardGroups.length === 0 ? (
          <Text style={styles.muted}>No store cards in this plan yet.</Text>
        ) : (
          <SettingsDebtGroups groupedDebts={storeCardGroups} currency={currency} asMoneyInput={asMoneyInput} onOpenDebtEditor={onOpenDebtEditor} />
        )}
      </View>
    </View>
  );
}
