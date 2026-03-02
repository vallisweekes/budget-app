import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import type { Debt } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";
import type { DebtGroupKey } from "@/lib/hooks/useSettingsDebtBuckets";

type Group = {
  key: DebtGroupKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: Debt[];
};

type Props = {
  groupedDebts: Group[];
  currency: string;
  asMoneyInput: (value: string | null | undefined) => string;
  onOpenDebtEditor: (debt: Debt) => void;
};

export default function SettingsDebtGroups({
  groupedDebts,
  currency,
  asMoneyInput,
  onOpenDebtEditor,
}: Props) {
  return (
    <>
      {groupedDebts.map((group) => (
        <View key={group.key} style={styles.debtTypeBlock}>
          <View style={styles.debtTypeHead}>
            <View style={styles.debtTypeIconWrap}>
              <Ionicons name={group.icon} size={14} color={T.textDim} />
            </View>
            <Text style={styles.debtTypeTitle}>{group.label}</Text>
            <Text style={styles.debtTypeCount}>{group.items.length}</Text>
          </View>

          {group.items.map((debt) => (
            <Pressable key={debt.id} style={styles.debtCard} onPress={() => onOpenDebtEditor(debt)}>
              <View style={styles.debtCardBody}>
                <Text style={styles.debtName}>{debt.name}</Text>
                <Text style={styles.debtSub}>{String(debt.type).replace("_", " ")}</Text>
                <Text style={styles.debtSub}>Current balance: {currency}{asMoneyInput(debt.currentBalance) || "0"}</Text>
                {debt.type === "credit_card" ? (
                  <Text style={styles.debtSub}>Credit limit: {currency}{asMoneyInput(debt.creditLimit) || "0"}</Text>
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
