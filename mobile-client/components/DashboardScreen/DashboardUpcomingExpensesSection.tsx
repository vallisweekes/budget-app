import { Image, Pressable, Text, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import type { DashboardUpcomingExpensesSectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { styles } from "@/components/DashboardScreen/style";

export default function DashboardUpcomingExpensesSection({
  items,
  currency,
  formatShortDate,
  isLogoFailed,
  onLogoError,
  onOpenExpenseDetail,
  onSeeAll,
}: DashboardUpcomingExpensesSectionProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t("dashboard.upcomingExpensesTitle")}</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>{t("common.seeAll")}</Text>
        </Pressable>
      </View>

      {items.length > 0 ? items.slice(0, 3).map((item) => {
        const logoUri = resolveLogoUri(item.logoUrl);
        const logoKey = `expense:${item.id}`;
        const showLogo = Boolean(logoUri) && !isLogoFailed(logoKey);
        const dateLabel = formatShortDate(item.dueDate);
        const subtitle = dateLabel
          ? t("dashboard.upcomingDueDate", { date: dateLabel })
          : item.dueDate
            ? t("dashboard.upcomingDueSoon")
            : t("dashboard.upcomingThisPayPeriod");

        return (
          <Pressable key={item.id} style={styles.lightRow} onPress={() => onOpenExpenseDetail(item)}>
            <View style={styles.lightLeft}>
              <View style={styles.lightAvatar}>
                {showLogo ? (
                  <Image
                    source={{ uri: logoUri ?? undefined }}
                    style={styles.avatarLogo}
                    resizeMode="cover"
                    onError={() => onLogoError(logoKey)}
                  />
                ) : (
                  <Text style={styles.lightAvatarTxt}>{(item.name.trim()?.[0] ?? "?").toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lightRowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.lightRowSub} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
            </View>
            <Text style={styles.lightRowAmt} numberOfLines={1}>
              {fmt(item.amount, currency)}
            </Text>
          </Pressable>
        );
      }) : (
        <Text style={styles.emptyUpcomingText}>{t("dashboard.upcomingEmpty")}</Text>
      )}
    </View>
  );
}