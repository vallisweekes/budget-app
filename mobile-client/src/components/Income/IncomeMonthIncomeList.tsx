import React from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Income, IncomeMonthData } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import IncomeMonthStats from "@/components/Income/IncomeMonthStats";
import IncomeBarChart from "@/components/Income/IncomeBarChart";
import { IncomeRow } from "@/components/Income/IncomeSourceItem";
import { IncomeAddForm } from "@/components/Income/IncomeAddForm";
import { s } from "@/screens/income-month/incomeMonthScreenStyles";

type CrudLike = {
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  newName: string;
  newAmount: string;
  setNewName: (value: string) => void;
  setNewAmount: (value: string) => void;
  distributeMonths: boolean;
  setDistributeMonths: (value: boolean) => void;
  distributeYears: boolean;
  setDistributeYears: (value: boolean) => void;
  handleAdd: () => Promise<void>;
  saving: boolean;
  startEdit: (item: Income) => void;
};

type Props = {
  items: Income[];
  analysis: IncomeMonthData | null;
  currency: string;
  isLocked: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  crud: CrudLike;
};

export default function IncomeMonthIncomeList({
  items,
  analysis,
  currency,
  isLocked,
  refreshing,
  onRefresh,
  crud,
}: Props) {
  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        ListHeaderComponent={
          <>
            {analysis && <IncomeMonthStats data={analysis} currency={currency} fmt={fmt} />}
            {analysis && <IncomeBarChart data={analysis} currency={currency} />}

            <View style={s.sourcesHeader}>
              <Text style={s.sourcesTitle}>Income sources</Text>
              <Text style={s.sourcesSub}>
                {isLocked ? "Past month — view only." : "Edit or remove income for this month."}
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) =>
          (
            <IncomeRow
              item={item}
              currency={currency}
              onPress={!isLocked ? () => crud.startEdit(item) : undefined}
            />
          )
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
            <Text style={s.emptyText}>No income sources yet</Text>
            {!isLocked && <Text style={s.emptySub}>Tap + to add your first source</Text>}
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
              <View style={sheet.handle} />
              <IncomeAddForm
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

const sheet = {
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    height: "82%",
    paddingBottom: 16,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: T.border,
  },
} as const;
