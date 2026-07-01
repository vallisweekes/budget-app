import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DashboardRecapSectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { styles } from "@/components/DashboardScreen/style";

export default function DashboardRecapSection({
  recap,
  hasRecapData,
  recapTitle,
  currency,
  onPressMissedPayments,
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

        <Pressable
          onPress={onPressMissedPayments}
          style={({ pressed }) => [
            styles.recapStatCard,
            styles.recapMissedCard,
            pressed && styles.recapMissedCardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.missedPaymentsOpenList")}
        >
          <View style={styles.recapMissedHeaderRow}>
            <Text style={styles.recapMissedTitle}>{t("dashboard.recapMissedPayment")}</Text>
            <Ionicons name="chevron-forward" size={16} color={T.textDim} />
          </View>
          <Text style={styles.recapMissedCount}>{recap.missedDueCount ?? 0}</Text>
          <Text style={styles.recapMissedAmount}>{fmt(recap.missedDueAmount ?? 0, currency)}</Text>
        </Pressable>
      </View>
    </View>
  );
}