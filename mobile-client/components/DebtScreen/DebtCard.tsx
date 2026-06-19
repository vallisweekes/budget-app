import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation } from "@/hooks";
import type { DebtSummaryItem } from "@/lib/apiTypes";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/constants";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { debtStyles as styles } from "@/components/DebtScreen/style";
import { resolveLogoUri } from "@/components/DebtScreen/utils";

export function DebtCard({
  debt,
  currency,
  onPress,
}: {
  debt: DebtSummaryItem;
  currency: string;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const [logoFailed, setLogoFailed] = useState(false);
  const accentColor = TYPE_COLORS[debt.type] ?? T.accent;
  const isCardDebt = debt.type === "credit_card" || debt.type === "store_card";
  const creditLimit = Math.max(0, Number(debt.creditLimit ?? 0));
  const currentBalance = Math.max(0, Number(debt.currentBalance ?? 0));
  const cardUtilizationPct = isCardDebt && creditLimit > 0
    ? (currentBalance / creditLimit) * 100
    : null;
  const progressPct = isCardDebt
    ? Math.min(100, Math.max(0, cardUtilizationPct ?? 0))
    : (debt.initialBalance > 0
        ? Math.min(100, ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100)
        : 100);
  const progressLabel = isCardDebt && creditLimit > 0
    ? (currentBalance > creditLimit
        ? t("debts.card.percentOverLimit", { percent: (((currentBalance - creditLimit) / creditLimit) * 100).toFixed(0) })
        : t("debts.card.percentUsed", { percent: progressPct.toFixed(0) }))
    : t("debts.card.percentPaid", { percent: progressPct.toFixed(0) });
  const isPaid = debt.paid || debt.currentBalance <= 0;
  const dueThisMonth = Math.max(0, debt.dueThisMonth ?? debt.computedMonthlyPayment ?? 0);
  const paidThisMonth = Math.max(0, debt.paidThisMonth ?? 0);
  const isPaymentMonthPaid = Boolean(debt.isPaymentMonthPaid) || (dueThisMonth > 0 && paidThisMonth >= dueThisMonth);
  const title = debt.displayTitle ?? debt.name;
  const typeLabel = debt.displaySubtitle ?? (() => {
    if (debt.type === "credit_card") return t("debts.type.creditCard");
    if (debt.type === "store_card") return t("debts.type.storeCard");
    if (debt.type === "loan") return t("debts.type.loan");
    if (debt.type === "mortgage") return t("debts.type.mortgage");
    if (debt.type === "hire_purchase") return t("debts.type.hirePurchase");
    if (debt.type === "other") return t("debts.type.other");
    return TYPE_LABELS[debt.type] ?? debt.type;
  })();
  const logoUri = resolveLogoUri(debt.logoUrl);
  const showLogo = Boolean(logoUri) && !logoFailed;
  const fallbackLetter = (title?.trim()?.[0] ?? "D").toUpperCase();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={[styles.cardGlow, { backgroundColor: `${accentColor}18` }]} />
      <View style={styles.cardInnerBorder} />
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View style={styles.cardTitleRow}>
              <View style={styles.avatar}>
                {showLogo ? (
                  <Image
                    source={{ uri: logoUri as string }}
                    style={styles.avatarLogo}
                    resizeMode="cover"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <Text style={styles.avatarTxt}>{fallbackLetter}</Text>
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{title}</Text>
            </View>
            <Text style={[styles.cardType, { color: accentColor }]}> 
              {typeLabel}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.cardBalance, isPaid && styles.cardBalancePaid]}>
              {isPaid ? t("debts.card.paidOff") : fmt(debt.currentBalance, currency)}
            </Text>
            {!isPaid && debt.computedMonthlyPayment > 0 ? (
              <Text style={styles.cardMonthly}>{t("debts.card.perMonth", { amount: fmt(debt.computedMonthlyPayment, currency) })}</Text>
            ) : null}
          </View>
        </View>

        {!isPaid ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%`, backgroundColor: accentColor }]} />
            </View>
            <Text style={styles.progressPct}>{progressLabel}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {!isPaid && dueThisMonth > 0 ? (
            <Text style={styles.cardMetaStrong}>
              {isPaymentMonthPaid
                ? t("debts.card.paidThisPeriod", { amount: fmt(paidThisMonth, currency) })
                : t("debts.card.dueThisPeriod", { amount: fmt(dueThisMonth, currency) })}
            </Text>
          ) : null}
          {debt.interestRate != null && debt.interestRate > 0 ? <Text style={styles.cardMeta}>{debt.interestRate}% APR</Text> : null}
          {debt.dueDay != null && !isPaid ? <Text style={styles.cardMeta}>{t("debts.card.dueDay", { day: debt.dueDay })}</Text> : null}
          {isPaid ? (
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={12} color={T.green} />
              <Text style={styles.paidBadgeText}>{t("debts.card.fullyPaid")}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={styles.cardChevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default DebtCard;