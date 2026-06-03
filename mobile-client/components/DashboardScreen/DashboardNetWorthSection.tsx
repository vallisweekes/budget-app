import { useMemo, type ComponentProps } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DashboardNetWorthSectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { styles } from "@/components/DashboardScreen/style";

type WealthRow = {
  id: string;
  label: string;
  amount: number;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconStyle: object;
  amountStyle?: object;
};

export default function DashboardNetWorthSection({
  netWorth,
  totalAssets,
  totalLiabilities,
  cashAsset,
  savingsAsset,
  emergencyAsset,
  investmentAsset,
  currency,
}: DashboardNetWorthSectionProps) {
  const rows = useMemo<WealthRow[]>(() => {
    const nextRows: WealthRow[] = [
      {
        id: "cash",
        label: "Cash",
        amount: Math.max(0, cashAsset),
        icon: "wallet-outline",
        iconStyle: styles.netWorthIconCash,
      },
      {
        id: "invest",
        label: "Invest",
        amount: Math.max(0, investmentAsset),
        icon: "stats-chart-outline",
        iconStyle: styles.netWorthIconInvest,
      },
      {
        id: "emergency",
        label: "Emergency",
        amount: Math.max(0, emergencyAsset),
        icon: "shield-checkmark-outline",
        iconStyle: styles.netWorthIconEmergency,
      },
      {
        id: "savings",
        label: "Savings",
        amount: Math.max(0, savingsAsset),
        icon: "save-outline",
        iconStyle: styles.netWorthIconSavings,
      },
    ];

    if (totalLiabilities > 0.0001) {
      nextRows.push({
        id: "liabilities",
        label: "Liabilities",
        amount: -Math.max(0, totalLiabilities),
        icon: "card-outline",
        iconStyle: styles.netWorthIconLiability,
        amountStyle: styles.netWorthRowAmountNegative,
      });
    }

    return nextRows;
  }, [cashAsset, emergencyAsset, investmentAsset, savingsAsset, totalLiabilities]);

  return (
    <View style={styles.netWorthCard}>
      <View style={styles.netWorthHeaderRow}>
        <Text style={styles.netWorthTitle}>Total Wealth</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(244,246,255,0.55)" />
      </View>

      <Text style={[styles.netWorthValue, netWorth >= 0 ? styles.netWorthValuePositive : styles.netWorthValueNegative]}>
        {fmt(netWorth, currency)}
      </Text>

      <View style={styles.netWorthMetaRow}>
        <Text style={styles.netWorthMetaText}>Assets {fmt(totalAssets, currency)}</Text>
        <Text style={styles.netWorthMetaDivider}>•</Text>
        <Text style={styles.netWorthMetaText}>Debt {fmt(totalLiabilities, currency)}</Text>
      </View>

      <View style={styles.netWorthList}>
        {rows.map((row) => (
          <View key={row.id} style={styles.netWorthRow}>
            <View style={styles.netWorthRowLeft}>
              <View style={[styles.netWorthIconWrap, row.iconStyle]}>
                <Ionicons name={row.icon} size={22} color="rgba(244,246,255,0.96)" />
              </View>
              <Text style={styles.netWorthRowTitle}>{row.label}</Text>
            </View>
            <Text style={[styles.netWorthRowAmount, row.amountStyle]}>{fmt(row.amount, currency)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}