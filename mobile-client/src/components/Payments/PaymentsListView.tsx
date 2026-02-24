import React from "react";
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fmt } from "@/lib/formatting";
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
  onOpenItem: (item: { kind: "expense" | "debt"; id: string; name: string; dueAmount: number }) => void;
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
        renderItem={({ item, section }) => (
          <Pressable
            onPress={() => {
              const kind = String(section?.title).toLowerCase() === "debts" ? "debt" : "expense";
              onOpenItem({ kind, id: item.id, name: item.name, dueAmount: item.dueAmount });
            }}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            <Text style={s.rowName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={s.rowAmt} numberOfLines={1}>
              {fmt(item.dueAmount, currency)}
            </Text>
          </Pressable>
        )}
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
