import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Income, IncomeMonthData } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import IncomeMonthStats from "@/components/Income/IncomeMonthStats";
import IncomeBarChart from "@/components/Income/IncomeBarChart";
import BillsSummary from "@/components/Income/BillsSummary";
import { IncomeRow, IncomeEditRow } from "@/components/Income/IncomeSourceItem";
import { IncomeAddForm } from "@/components/Income/IncomeAddForm";
import { s } from "@/screens/income-month/incomeMonthScreenStyles";

type CrudLike = {
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  editingId: string | null;
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
  editName: string;
  editAmount: string;
  setEditName: (value: string) => void;
  setEditAmount: (value: string) => void;
  handleSaveEdit: () => Promise<void>;
  cancelEdit: () => void;
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
  onRequestDelete: (income: Income) => void;
};

export default function IncomeMonthIncomeList({
  items,
  analysis,
  currency,
  isLocked,
  refreshing,
  onRefresh,
  crud,
  onRequestDelete,
}: Props) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
      ListHeaderComponent={
        <>
          {analysis && <IncomeMonthStats data={analysis} currency={currency} fmt={fmt} />}
          {analysis && <IncomeBarChart data={analysis} currency={currency} />}
          {analysis && <BillsSummary data={analysis} currency={currency} fmt={fmt} />}

          <View style={s.sourcesHeader}>
            <Text style={s.sourcesTitle}>Income sources</Text>
            <Text style={s.sourcesSub}>
              {isLocked ? "Past month — view only." : "Add, edit, or remove income for this month."}
            </Text>
          </View>

          {!isLocked && crud.showAddForm && (
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
          )}
        </>
      }
      renderItem={({ item }) =>
        !isLocked && crud.editingId === item.id ? (
          <IncomeEditRow
            editName={crud.editName}
            editAmount={crud.editAmount}
            setEditName={crud.setEditName}
            setEditAmount={crud.setEditAmount}
            onSave={crud.handleSaveEdit}
            onCancel={crud.cancelEdit}
            saving={crud.saving}
          />
        ) : (
          <IncomeRow
            item={item}
            currency={currency}
            fmt={fmt}
            onEdit={!isLocked ? () => crud.startEdit(item) : undefined}
            onDelete={!isLocked ? () => onRequestDelete(item) : undefined}
          />
        )
      }
      ListEmptyComponent={
        !crud.showAddForm ? (
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={T.iconMuted} />
            <Text style={s.emptyText}>No income sources yet</Text>
            {!isLocked && <Text style={s.emptySub}>Tap + to add your first source</Text>}
          </View>
        ) : null
      }
    />
  );
}
