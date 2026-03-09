import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const [logoFailed, setLogoFailed] = useState(false);
  const accentColor = TYPE_COLORS[debt.type] ?? T.accent;
  const progressPct =
    debt.initialBalance > 0
      ? Math.min(100, ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100)
      : 100;
  const isPaid = debt.paid || debt.currentBalance <= 0;
  const dueThisMonth = Math.max(0, debt.dueThisMonth ?? debt.computedMonthlyPayment ?? 0);
  const paidThisMonth = Math.max(0, debt.paidThisMonth ?? 0);
  const isPaymentMonthPaid = Boolean(debt.isPaymentMonthPaid) || (dueThisMonth > 0 && paidThisMonth >= dueThisMonth);
  const title = debt.displayTitle ?? debt.name;
  const logoUri = resolveLogoUri(debt.logoUrl);
  const showLogo = Boolean(logoUri) && !logoFailed;
  const fallbackLetter = (title?.trim()?.[0] ?? "D").toUpperCase();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
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
              {debt.displaySubtitle ?? TYPE_LABELS[debt.type] ?? debt.type}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.cardBalance, isPaid && styles.cardBalancePaid]}>
              {isPaid ? "Paid off" : fmt(debt.currentBalance, currency)}
            </Text>
            {!isPaid && debt.computedMonthlyPayment > 0 ? (
              <Text style={styles.cardMonthly}>{fmt(debt.computedMonthlyPayment, currency)}/mo</Text>
            ) : null}
          </View>
        </View>

        {!isPaid ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%`, backgroundColor: accentColor }]} />
            </View>
            <Text style={styles.progressPct}>{progressPct.toFixed(0)}% paid</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {!isPaid && dueThisMonth > 0 ? (
            <Text style={styles.cardMetaStrong}>
              {isPaymentMonthPaid ? "Paid this period" : "Due this period"} {fmt(isPaymentMonthPaid ? paidThisMonth : dueThisMonth, currency)}
            </Text>
          ) : null}
          {debt.interestRate != null && debt.interestRate > 0 ? <Text style={styles.cardMeta}>{debt.interestRate}% APR</Text> : null}
          {debt.dueDay != null && !isPaid ? <Text style={styles.cardMeta}>Due day {debt.dueDay}</Text> : null}
          {isPaid ? (
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={12} color={T.green} />
              <Text style={styles.paidBadgeText}>Fully paid</Text>
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