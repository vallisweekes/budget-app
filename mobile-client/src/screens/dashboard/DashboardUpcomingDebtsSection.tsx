import { Image, Pressable, Text, View } from "react-native";

import { fmt, normalizeUpcomingName } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { styles } from "@/screens/dashboard/styles";

type UpcomingDebt = {
  id: string;
  name: string;
  dueAmount?: number | null;
  logoUrl?: string | null;
};

type DashboardUpcomingDebtsSectionProps = {
  items: UpcomingDebt[];
  currency: string;
  isLogoFailed: (key: string) => boolean;
  onLogoError: (key: string) => void;
  onOpenQuickPay: (debt: UpcomingDebt) => void;
  onSeeAll: () => void;
};

export default function DashboardUpcomingDebtsSection({
  items,
  currency,
  isLogoFailed,
  onLogoError,
  onOpenQuickPay,
  onSeeAll,
}: DashboardUpcomingDebtsSectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={[styles.section, styles.blueSection]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, styles.blueSectionTitle, { marginBottom: 0 }]}>Upcoming Debts</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </View>

      {items.slice(0, 3).map((item) => {
        const logoUri = resolveLogoUri(item.logoUrl);
        const logoKey = `debt:${item.id}`;
        const showLogo = Boolean(logoUri) && !isLogoFailed(logoKey);
        const displayName = normalizeUpcomingName(item.name);

        return (
          <Pressable key={item.id} style={styles.blueRow} onPress={() => onOpenQuickPay(item)}>
            <View style={styles.blueLeft}>
              <View style={styles.blueAvatar}>
                {showLogo ? (
                  <Image
                    source={{ uri: logoUri ?? undefined }}
                    style={styles.avatarLogo}
                    resizeMode="cover"
                    onError={() => onLogoError(logoKey)}
                  />
                ) : (
                  <Text style={styles.blueAvatarTxt}>{(item.name.trim()?.[0] ?? "D").toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.blueRowTitle} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.blueRowSub} numberOfLines={1}>
                  Monthly payment
                </Text>
              </View>
            </View>
            <Text style={styles.blueRowAmt} numberOfLines={1}>
              {fmt(item.dueAmount ?? 0, currency)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}