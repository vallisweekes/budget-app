import { Text, View } from "react-native";

import type { DashboardRecapSectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { useAppTranslation } from "@/hooks";
import { styles } from "@/components/DashboardScreen/style";

export default function DashboardRecapSection({
  recap,
  hasRecapData,
  recapTitle,
  currency,
}: DashboardRecapSectionProps) {
  const { t } = useAppTranslation();

  if (!recap || !hasRecapData) return null;

  return (
    <View style={styles.recapWrap}>
      <View style={styles.recapBadge}>
        <Text style={styles.recapBadgeText}>{recapTitle}</Text>
      </View>

      <View style={styles.recapGrid}>
        <View style={[styles.recapStatCard, styles.recapPaidCard]}>
          <Text style={styles.recapStatLabel}>{t("dashboard.recapPaid")}</Text>
          <Text style={styles.recapStatCount}>{recap.paidCount ?? 0}</Text>
          <Text style={styles.recapStatAmount}>{fmt(recap.paidAmount ?? 0, currency)}</Text>
        </View>

        <View style={[styles.recapStatCard, styles.recapMissedCard]}>
          <Text style={styles.recapMissedTitle}>{t("dashboard.recapMissedPayment")}</Text>
          <Text style={styles.recapMissedCount}>{recap.missedDueCount ?? 0}</Text>
          <Text style={styles.recapMissedAmount}>{fmt(recap.missedDueAmount ?? 0, currency)}</Text>
        </View>
      </View>
    </View>
  );
}