import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsDebtGroups from "@/components/Settings/SettingsDebtGroups";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import { asMoneyInput } from "@/lib/helpers/settings";
import type { SettingsMoneyCardsViewProps } from "@/types/components/settings/SettingsMoneyCardsView.types";

export default function SettingsMoneyCardsView({ currency, creditCardGroups, storeCardGroups, onAddDebt, onOpenDebtEditor }: SettingsMoneyCardsViewProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.plainSavingsBlock}>
      <View>
        <View style={styles.plainSectionHeadRow}>
          <Text style={styles.plainBudgetTitle}>{t("settings.cards.creditCards")}</Text>
          <Pressable onPress={onAddDebt} style={styles.addCardBtn}>
            <Ionicons name="add" size={16} color={T.onAccent} />
            <Text style={styles.addCardBtnText}>{t("settings.cards.card")}</Text>
          </Pressable>
        </View>
        {creditCardGroups.length === 0 ? (
          <Text style={styles.muted}>{t("settings.cards.noCreditCards")}</Text>
        ) : (
          <SettingsDebtGroups groupedDebts={creditCardGroups} currency={currency} asMoneyInput={asMoneyInput} onOpenDebtEditor={onOpenDebtEditor} />
        )}
      </View>

      <View style={styles.moneySectionCard}>
        <View style={styles.plainSectionHeadRow}>
          <Text style={styles.plainBudgetTitle}>{t("settings.cards.storeCards")}</Text>
        </View>
        {storeCardGroups.length === 0 ? (
          <Text style={styles.muted}>{t("settings.cards.noStoreCards")}</Text>
        ) : (
          <SettingsDebtGroups groupedDebts={storeCardGroups} currency={currency} asMoneyInput={asMoneyInput} onOpenDebtEditor={onOpenDebtEditor} />
        )}
      </View>
    </View>
  );
}
