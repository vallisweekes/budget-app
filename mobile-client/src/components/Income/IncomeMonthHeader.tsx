import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";

type Props = {
  monthLabel: string;
  isLocked: boolean;
  viewMode: "income" | "sacrifice";
  showAddForm: boolean;
  hideNavTitleRow?: boolean;
  onBack: () => void;
  onToggleAdd: () => void;
  onSetMode: (mode: "income" | "sacrifice") => void;
};

export default function IncomeMonthHeader({
  monthLabel,
  isLocked,
  viewMode,
  showAddForm,
  hideNavTitleRow = false,
  onBack,
  onToggleAdd,
  onSetMode,
}: Props) {
  return (
    <>
      {!hideNavTitleRow ? (
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
          <Text style={s.headerTitle}>{monthLabel}</Text>
          {viewMode === "income" ? (
            <Pressable onPress={onToggleAdd} style={s.addBtn} hitSlop={8} disabled={isLocked}>
              <Ionicons
                name={isLocked ? "lock-closed-outline" : showAddForm ? "close" : "add"}
                size={18}
                color={isLocked ? T.textMuted : T.text}
              />
            </Pressable>
          ) : <View style={s.addBtn} />}
        </View>
      ) : (
        <View style={s.headerSlim}>
          <View style={s.sideSpacer} />
        </View>
      )}

      <View style={s.modeWrap}>
        <Pressable style={[s.modePill, viewMode === "income" && s.modePillActive]} onPress={() => onSetMode("income")}>
          <Text style={[s.modeTxt, viewMode === "income" && s.modeTxtActive]}>Income</Text>
        </Pressable>
        <Pressable style={[s.modePill, viewMode === "sacrifice" && s.modePillActive]} onPress={() => onSetMode("sacrifice")}>
          <Text style={[s.modeTxt, viewMode === "sacrifice" && s.modeTxtActive]}>Income sacrifice</Text>
        </Pressable>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { padding: 4 },
  headerSlim: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  sideSpacer: { flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "900", flex: 1, textAlign: "center" },
  modeWrap: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    padding: 4,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: T.accent,
  },
  modeTxt: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
  },
  modeTxtActive: {
    color: T.onAccent,
  },
});
