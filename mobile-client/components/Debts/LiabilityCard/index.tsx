import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DebtSummaryItem } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";
import { resolveLogoUri } from "@/components/DebtScreen/utils";

type Props = {
  item: DebtSummaryItem;
  currency: string;
  onPress: (item: DebtSummaryItem) => void;
};

export default function LiabilityCard({ item, currency, onPress }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUri = resolveLogoUri(item.logoUrl);
  const showLogo = Boolean(logoUri) && !logoFailed;
  const fallbackLetter = (item.displayTitle ?? item.name ?? "?").trim()[0]?.toUpperCase() ?? "?";

  const progressPct = (() => {
    const initial = Number(item.initialBalance ?? item.currentBalance ?? 0);
    const current = Number(item.currentBalance ?? 0);
    if (!initial || initial <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - current / initial));
  })();

  const monthlyLabel = item.computedMonthlyPayment > 0
    ? `${fmt(item.computedMonthlyPayment, currency)} / mo`
    : null;

  const rateLabel = item.interestRate != null && Number(item.interestRate) > 0
    ? `${Number(item.interestRate).toFixed(2)}% APR`
    : null;

  const typeLabel = item.displaySubtitle ?? item.type;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      {/* left teal accent bar */}
      <View style={styles.accent} />

      <View style={styles.body}>
        {/* top row */}
        <View style={styles.topRow}>
          <View style={styles.left}>
            <View style={styles.avatar}>
              {showLogo ? (
                <Image
                  source={{ uri: logoUri as string }}
                  style={styles.avatarLogo}
                  resizeMode="cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <Text style={styles.avatarLetter}>{fallbackLetter}</Text>
              )}
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.name} numberOfLines={1}>{item.displayTitle ?? item.name}</Text>
              <Text style={styles.subtitle}>{typeLabel}</Text>
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.balance}>{fmt(Number(item.currentBalance ?? 0), currency)}</Text>
            <Text style={styles.balanceSub}>outstanding</Text>
          </View>
        </View>

        {/* meta row */}
        {(monthlyLabel ?? rateLabel) ? (
          <View style={styles.metaRow}>
            {monthlyLabel ? (
              <View style={styles.chip}>
                <Ionicons name="calendar-outline" size={12} color={TEAL} style={{ marginRight: 4 }} />
                <Text style={styles.chipText}>{monthlyLabel}</Text>
              </View>
            ) : null}
            {rateLabel ? (
              <View style={styles.chip}>
                <Ionicons name="trending-up-outline" size={12} color={T.textDim} style={{ marginRight: 4 }} />
                <Text style={styles.chipText}>{rateLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* progress bar */}
        {progressPct > 0 ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progressPct * 100)}%` }]} />
          </View>
        ) : null}
      </View>

      <View style={styles.chevronWrap}>
        <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
      </View>
    </Pressable>
  );
}

const TEAL = "#14b8a6";

const styles = StyleSheet.create({
  card: {
    ...cardElevated,
    flexDirection: "row",
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 24,
    borderColor: `${TEAL}28`,
    backgroundColor: "rgba(20,24,38,0.56)",
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.75 },
  accent: {
    width: 5,
    backgroundColor: TEAL,
    opacity: 0.7,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: `${TEAL}22`,
    borderWidth: 1,
    borderColor: `${TEAL}44`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  avatarLogo: {
    width: 38,
    height: 38,
    borderRadius: 14,
  },
  avatarLetter: {
    color: TEAL,
    fontSize: 16,
    fontWeight: "800",
  },
  titleBlock: { flex: 1, minWidth: 0 },
  name: {
    color: T.text,
    fontSize: 15,
    fontWeight: "800",
  },
  subtitle: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  right: { alignItems: "flex-end", flexShrink: 0, marginLeft: 8 },
  balance: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
  },
  balanceSub: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chipText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 999,
    opacity: 0.7,
  },
  chevronWrap: {
    justifyContent: "center",
    paddingRight: 14,
  },
});
