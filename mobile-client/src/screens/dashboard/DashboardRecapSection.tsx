import { Text, View } from "react-native";

import { fmt } from "@/lib/formatting";
import { styles } from "@/screens/dashboard/styles";

type DashboardRecap = {
  paidCount?: number;
  paidAmount?: number;
  missedDueCount?: number;
  missedDueAmount?: number;
};

type DashboardRecapSectionProps = {
  recap: DashboardRecap | null;
  hasRecapData: boolean;
  recapTitle: string;
  currency: string;
};

export default function DashboardRecapSection({
  recap,
  hasRecapData,
  recapTitle,
  currency,
}: DashboardRecapSectionProps) {
  if (!recap || !hasRecapData) return null;

  return (
    <View style={styles.recapWrap}>
      <View style={styles.recapBadge}>
        <Text style={styles.recapBadgeText}>{recapTitle}</Text>
      </View>

      <View style={styles.recapGrid}>
        <View style={[styles.recapStatCard, styles.recapPaidCard]}>
          <Text style={styles.recapStatLabel}>Paid</Text>
          <Text style={styles.recapStatCount}>{recap.paidCount ?? 0}</Text>
          <Text style={styles.recapStatAmount}>{fmt(recap.paidAmount ?? 0, currency)}</Text>
        </View>

        <View style={[styles.recapStatCard, styles.recapMissedCard]}>
          <Text style={styles.recapMissedTitle}>Missed payment</Text>
          <Text style={styles.recapMissedCount}>{recap.missedDueCount ?? 0}</Text>
          <Text style={styles.recapMissedAmount}>{fmt(recap.missedDueAmount ?? 0, currency)}</Text>
        </View>
      </View>
    </View>
  );
}