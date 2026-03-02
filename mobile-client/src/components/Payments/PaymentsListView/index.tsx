import React from "react";
import { Image, Pressable, RefreshControl, SectionList, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fmt } from "@/lib/formatting";
import { resolveLogoUri } from "@/lib/logoDisplay";
import { T } from "@/lib/theme";
import type { DebtRow, ExpenseRow } from "@/lib/hooks/usePaymentsSections";
import { s } from "@/screens/payments/paymentsScreenStyles";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  sections: Array<{ title: string; data: Array<ExpenseRow | DebtRow> }>;
  refreshing: boolean;
  onRefresh: () => void;
  currency: string;
  showEmpty: boolean;
  onOpenItem: (item: { kind: "expense" | "debt"; id: string; name: string; dueAmount: number; logoUrl?: string | null }) => void;
};

export default function PaymentsListView({
  query,
  onQueryChange,
  sections,
  refreshing,
  onRefresh,
  currency,
  showEmpty,
  onOpenItem,
}: Props) {
  const [failedLogos, setFailedLogos] = React.useState<Record<string, boolean>>({});

  const renderRow = React.useCallback(
    ({ item, section }: { item: ExpenseRow | DebtRow; section: { title: string } }) => {
      const kind = String(section?.title).toLowerCase() === "debts" ? "debt" : "expense";
      const logoKey = `${kind}:${item.id}`;
      const logoUri = resolveLogoUri(item.logoUrl ?? null);
      const showLogo = Boolean(logoUri) && !failedLogos[logoKey];

      return (
        <Pressable
          onPress={() => {
            onOpenItem({ kind, id: item.id, name: item.name, dueAmount: item.dueAmount, logoUrl: item.logoUrl ?? null });
          }}
          style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        >
          <View style={s.rowLeft}>
            <View style={s.rowAvatar}>
              {showLogo ? (
                <Image
                  source={{ uri: logoUri as string }}
                  style={s.rowAvatarLogo}
                  resizeMode="cover"
                  onError={() => setFailedLogos((prev) => ({ ...prev, [logoKey]: true }))}
                />
              ) : (
                <Text style={s.rowAvatarTxt}>{(item.name?.trim()?.[0] ?? "?").toUpperCase()}</Text>
              )}
            </View>
            <Text style={s.rowName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={s.rowAmt} numberOfLines={1}>
            {fmt(item.dueAmount, currency)}
          </Text>
        </Pressable>
      );
    },
    [currency, failedLogos, onOpenItem]
  );

  return (
    <>
      <View style={[s.searchWrap, { marginTop: 10 }]}>
        <Ionicons name="search" size={16} color={T.textDim} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search"
          placeholderTextColor={T.textMuted}
          style={s.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <SectionList
        sections={sections as any}
        keyExtractor={(item: ExpenseRow | DebtRow) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          showEmpty ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>No payments due this month</Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />
    </>
  );
}
