import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { IncomeSacrificeCustomItem, IncomeSacrificeFixed } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { fmt } from "@/lib/formatting";

type SacrificeType = "allowance" | "savings" | "emergency" | "investment" | "custom";

type Props = {
  currency: string;
  fixed: IncomeSacrificeFixed;
  customItems: IncomeSacrificeCustomItem[];
  customTotal: number;
  totalSacrifice: number;
  saving: boolean;
  creating: boolean;
  deletingId: string | null;
  newType: SacrificeType;
  newName: string;
  newAmount: string;
  onChangeFixed: (key: keyof IncomeSacrificeFixed, value: string) => void;
  onSaveFixed: () => void;
  onChangeCustomAmount: (id: string, value: string) => void;
  onSaveCustomAmounts: () => void;
  onDeleteCustom: (id: string) => void;
  onSetNewType: (value: SacrificeType) => void;
  onSetNewName: (value: string) => void;
  onSetNewAmount: (value: string) => void;
  onCreateCustom: () => void;
};

const TYPE_OPTIONS: Array<{ key: SacrificeType; label: string }> = [
  { key: "allowance", label: "Allowance" },
  { key: "savings", label: "Savings" },
  { key: "emergency", label: "Emergency" },
  { key: "investment", label: "Investments" },
  { key: "custom", label: "Custom" },
];

export default function IncomeSacrificeEditor({
  currency,
  fixed,
  customItems,
  customTotal,
  totalSacrifice,
  saving,
  creating,
  deletingId,
  newType,
  newName,
  newAmount,
  onChangeFixed,
  onSaveFixed,
  onChangeCustomAmount,
  onSaveCustomAmounts,
  onDeleteCustom,
  onSetNewType,
  onSetNewName,
  onSetNewAmount,
  onCreateCustom,
}: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Income sacrifice total</Text>
        <Text style={s.summaryValue}>{fmt(totalSacrifice, currency)}</Text>
        <Text style={s.summarySub}>Custom total: {fmt(customTotal, currency)}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Fixed monthly sacrifice</Text>
        <Text style={s.label}>Monthly allowance ({currency})</Text>
        <TextInput style={s.input} value={String(fixed.monthlyAllowance)} onChangeText={(v) => onChangeFixed("monthlyAllowance", v)} keyboardType="decimal-pad" />

        <Text style={s.label}>Savings ({currency})</Text>
        <TextInput style={s.input} value={String(fixed.monthlySavingsContribution)} onChangeText={(v) => onChangeFixed("monthlySavingsContribution", v)} keyboardType="decimal-pad" />

        <Text style={s.label}>Emergency fund ({currency})</Text>
        <TextInput style={s.input} value={String(fixed.monthlyEmergencyContribution)} onChangeText={(v) => onChangeFixed("monthlyEmergencyContribution", v)} keyboardType="decimal-pad" />

        <Text style={s.label}>Investments ({currency})</Text>
        <TextInput style={s.input} value={String(fixed.monthlyInvestmentContribution)} onChangeText={(v) => onChangeFixed("monthlyInvestmentContribution", v)} keyboardType="decimal-pad" />

        <Pressable style={[s.saveBtn, saving && s.disabled]} onPress={onSaveFixed} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Save fixed</Text>}
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Custom sacrifice items</Text>
        {customItems.length === 0 ? <Text style={s.empty}>No custom items yet.</Text> : null}

        {customItems.map((item) => (
          <View key={item.id} style={s.customRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.customName}>{item.name}</Text>
              <TextInput
                style={s.input}
                value={String(item.amount)}
                onChangeText={(v) => onChangeCustomAmount(item.id, v)}
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable
              style={[s.deleteBtn, deletingId === item.id && s.disabled]}
              onPress={() => onDeleteCustom(item.id)}
              disabled={deletingId === item.id}
            >
              <Text style={s.deleteTxt}>Delete</Text>
            </Pressable>
          </View>
        ))}

        {customItems.length > 0 ? (
          <Pressable style={[s.saveBtn, saving && s.disabled]} onPress={onSaveCustomAmounts} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Save custom amounts</Text>}
          </Pressable>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Add sacrifice item</Text>
        <View style={s.typeRow}>
          {TYPE_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[s.typePill, newType === option.key && s.typePillActive]}
              onPress={() => onSetNewType(option.key)}
            >
              <Text style={[s.typeTxt, newType === option.key && s.typeTxtActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {newType === "custom" ? (
          <>
            <Text style={s.label}>Custom name</Text>
            <TextInput
              style={s.input}
              value={newName}
              onChangeText={onSetNewName}
              placeholder="Enter custom sacrifice name"
              placeholderTextColor={T.textMuted}
            />
          </>
        ) : null}

        <Text style={s.label}>Amount ({currency})</Text>
        <TextInput
          style={s.input}
          value={newAmount}
          onChangeText={onSetNewAmount}
          placeholder="0.00"
          placeholderTextColor={T.textMuted}
          keyboardType="decimal-pad"
        />

        <Pressable style={[s.saveBtn, creating && s.disabled]} onPress={onCreateCustom} disabled={creating}>
          {creating ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Add item</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  summaryCard: {
    backgroundColor: T.card,
    borderWidth: 2,
    borderColor: T.accentBorder,
    borderRadius: 14,
    padding: 14,
  },
  summaryTitle: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  summaryValue: { color: T.text, fontSize: 22, fontWeight: "900", marginTop: 4 },
  summarySub: { color: T.textMuted, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: T.card,
    borderWidth: 2,
    borderColor: T.accentBorder,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardTitle: { color: T.text, fontSize: 14, fontWeight: "900", marginBottom: 2 },
  label: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 2 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 6,
  },
  saveBtnTxt: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
  customRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  customName: { color: T.text, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  deleteBtn: {
    backgroundColor: `${T.red}22`,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteTxt: { color: T.red, fontSize: 12, fontWeight: "800" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typePillActive: { borderColor: T.accent, backgroundColor: `${T.accent}22` },
  typeTxt: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  typeTxtActive: { color: T.accent, fontWeight: "800" },
  empty: { color: T.textMuted, fontSize: 12, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
