import { Image, Pressable, Text, View } from "react-native";

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
  onOpenQuickPay,
  onSeeAll,
}: DashboardUpcomingExpensesSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Upcoming Expenses</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </View>

      {items.length > 0 ? items.slice(0, 3).map((item) => {
        const logoUri = resolveLogoUri(item.logoUrl);
        const logoKey = `expense:${item.id}`;
        const showLogo = Boolean(logoUri) && !isLogoFailed(logoKey);
        const dateLabel = formatShortDate(item.dueDate);
        const subtitle = item.urgency === "overdue"
          ? "Overdue"
          : item.urgency === "today"
            ? "Due today"
            : dateLabel
              ? `Next on ${dateLabel}`
              : `In ${item.daysUntilDue}d`;

        return (
          <Pressable key={item.id} style={styles.lightRow} onPress={() => onOpenQuickPay(item)}>
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
        <Text style={styles.emptyUpcomingText}>No upcoming expenses yet. Add or schedule expenses to see them here.</Text>
      )}
    </View>
  );
}