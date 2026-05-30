import React from "react";
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation } from "@/hooks";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import IncomeMonthStats from "@/components/Income/IncomeMonthStats";
import IncomeBarChart from "@/components/Income/IncomeBarChart";
import { IncomeRow } from "@/components/Income/IncomeSourceItem";
import { IncomeAddForm } from "@/components/Income/IncomeAddForm";
import { incomeMonthIncomeListSheet as sheet } from "@/components/Income/IncomeMonthIncomeList/style";
import { s } from "@/components/IncomeMonthScreen/style";
import type { IncomeMonthIncomeListProps } from "@/types";

export default function IncomeMonthIncomeList({
  items,
  analysis,
  currency,
  isLocked,
  topInset = 0,
  refreshing,
  onRefresh,
  onPressIncomeSacrifice,
  crud,
}: IncomeMonthIncomeListProps) {
  const { t } = useAppTranslation();
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const aIsSalary = String(a.name ?? "").trim().toLowerCase() === "salary";
      const bIsSalary = String(b.name ?? "").trim().toLowerCase() === "salary";
      if (aIsSalary === bIsSalary) return 0;
      return aIsSalary ? -1 : 1;
    });
  }, [items]);

  return (
    <>
      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item.id}
        style={s.body}
        contentContainerStyle={[s.scroll, { paddingTop: topInset }]}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        ListHeaderComponent={
          <>
            {analysis && <IncomeBarChart data={analysis} currency={currency} />}
            {analysis && <IncomeMonthStats data={analysis} currency={currency} fmt={fmt} onPressIncomeSacrifice={onPressIncomeSacrifice} />}
            <View style={s.sourcesHeadingWrap}>
              <Text style={s.sourcesHeading}>{t("income.section.sources")}</Text>
              <View style={s.sourcesHeadingRule} />
            </View>
          </>
        }
        renderItem={({ item, index }) =>
          (
            <View style={index === 0 ? s.firstIncomeRowWrap : undefined}>
              <IncomeRow
                item={item}
                currency={currency}
                onPress={!isLocked ? () => crud.startEdit(item) : undefined}
              />
            </View>
          )
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
            <Text style={s.emptyText}>{t("income.empty.noSources")}</Text>
            {!isLocked && <Text style={s.emptySub}>{t("income.empty.addFromTabBar")}</Text>}
          </View>
        }
      />

      {!isLocked && (
        <Modal
          visible={crud.showAddForm}
          transparent
          animationType="slide"
          presentationStyle="overFullScreen"
          onRequestClose={() => crud.setShowAddForm(false)}
        >
          <View style={sheet.overlay}>
            <Pressable style={sheet.backdrop} onPress={() => crud.setShowAddForm(false)} />
            <View style={sheet.sheet}>
              <View pointerEvents="none" style={sheet.innerStroke} />
              <View style={sheet.handle} />
              <IncomeAddForm
                currency={currency}
                name={crud.newName}
                amount={crud.newAmount}
                setName={crud.setNewName}
                setAmount={crud.setNewAmount}
                distributeMonths={crud.distributeMonths}
                setDistributeMonths={crud.setDistributeMonths}
                distributeYears={crud.distributeYears}
                setDistributeYears={crud.setDistributeYears}
                onAdd={crud.handleAdd}
                saving={crud.saving}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
