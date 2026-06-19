import React, { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import { useAppTranslation } from "@/hooks";
import { resolveLogoUri } from "@/components/DebtScreen/utils";
import { T } from "@/lib/theme";
import type { SettingsDebtGroupsProps } from "@/types/components/settings/SettingsDebtGroups.types";

function toNumber(value: string | null | undefined): number {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function resolveCardAvailableAmount(currentBalance: number, creditLimit: number): number {
  if (creditLimit <= 0) return 0;
  return Math.max(creditLimit - currentBalance, 0);
}

function SettingsDebtCard({
  debt,
  currency,
  asMoneyInput,
  onOpenDebtEditor,
}: {
  debt: SettingsDebtGroupsProps["groupedDebts"][number]["items"][number];
  currency: string;
  asMoneyInput: SettingsDebtGroupsProps["asMoneyInput"];
  onOpenDebtEditor: SettingsDebtGroupsProps["onOpenDebtEditor"];
}) {
  const { t } = useAppTranslation();
  const [logoFailed, setLogoFailed] = useState(false);
  const balance = useMemo(() => toNumber(debt.currentBalance), [debt.currentBalance]);
  const creditLimit = useMemo(() => toNumber(debt.creditLimit), [debt.creditLimit]);
  const availableToSpend = resolveCardAvailableAmount(balance, creditLimit);
  const outstandingBalance = Math.max(creditLimit - availableToSpend, 0);
  const utilizationPct = creditLimit > 0 ? Math.min(100, Math.round((outstandingBalance / creditLimit) * 100)) : null;
  const accentColor = debt.type === "store_card" ? "#35D39A" : T.accent;
  const logoUri = resolveLogoUri(debt.logoUrl);
  const showLogo = Boolean(logoUri) && !logoFailed;
  const fallbackLetter = (String(debt.name ?? "").trim()[0] ?? "C").toUpperCase();

  return (
    <Pressable key={debt.id} style={styles.debtCard} onPress={() => onOpenDebtEditor(debt)}>
      <View style={styles.debtCardTopRow}>
        <View style={[styles.debtLogoWrap, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}16` }]}>
          {showLogo ? (
            <Image
              source={{ uri: logoUri as string }}
              style={styles.debtLogo}
              resizeMode="cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Text style={styles.debtLogoFallback}>{fallbackLetter}</Text>
          )}
        </View>

        <View style={styles.debtCardBody}>
          <View style={styles.debtTitleRow}>
            <Text style={styles.debtName} numberOfLines={1}>{debt.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={T.textDim} />
          </View>
          {creditLimit > 0 ? <Text style={styles.availableAmount}>{t("debts.add.creditLimit")}: {currency}{asMoneyInput(String(creditLimit)) || "0"}</Text> : null}
        </View>
      </View>

      {creditLimit > 0 ? (
        <View style={styles.utilizationWrap}>
          <View style={styles.utilizationBar}>
            <View
              style={[
                styles.utilizationFill,
                { width: `${utilizationPct ?? 0}%` as `${number}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
          <View style={styles.utilizationMetaRow}>
            <Text style={styles.utilizationMetaText}>{utilizationPct}% used</Text>
            <Text style={styles.utilizationMetaText}>{currency}{asMoneyInput(String(availableToSpend)) || "0"} available</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

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
            <Text style={styles.debtTypeTitle}>{group.label || (group.key === "credit_card" ? t("settings.cards.creditCards") : t("settings.cards.storeCards"))}</Text>
            <Text style={styles.debtTypeCount}>{group.items.length}</Text>
          </View>

          {group.items.map((debt) => (
            <SettingsDebtCard
              key={debt.id}
              debt={debt}
              currency={currency}
              asMoneyInput={asMoneyInput}
              onOpenDebtEditor={onOpenDebtEditor}
            />
          ))}
        </View>
      ))}
    </>
  );
}
