import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { T } from "@/lib/theme";
import { fmt } from "@/lib/formatting";
import MoneyInput from "@/components/Shared/MoneyInput";
import { styles } from "./styles";
import type { IncomeSacrificeEditorProps, SacrificeType } from "@/types";

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
}: IncomeSacrificeEditorProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Income sacrifice total</Text>
        <Text style={styles.summaryValue}>{fmt(totalSacrifice, currency)}</Text>
        <Text style={styles.summarySub}>Custom total: {fmt(customTotal, currency)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fixed monthly sacrifice</Text>
        <Text style={styles.label}>Monthly allowance ({currency})</Text>
        <MoneyInput currency={currency} value={String(fixed.monthlyAllowance)} onChangeValue={(v) => onChangeFixed("monthlyAllowance", v)} />

        <Text style={styles.label}>Savings ({currency})</Text>
        <MoneyInput currency={currency} value={String(fixed.monthlySavingsContribution)} onChangeValue={(v) => onChangeFixed("monthlySavingsContribution", v)} />

        <Text style={styles.label}>Emergency fund ({currency})</Text>
        <MoneyInput currency={currency} value={String(fixed.monthlyEmergencyContribution)} onChangeValue={(v) => onChangeFixed("monthlyEmergencyContribution", v)} />

        <Text style={styles.label}>Investments ({currency})</Text>
        <MoneyInput currency={currency} value={String(fixed.monthlyInvestmentContribution)} onChangeValue={(v) => onChangeFixed("monthlyInvestmentContribution", v)} />

        <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={onSaveFixed} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>Save fixed</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Custom sacrifice items</Text>
        {customItems.length === 0 ? <Text style={styles.empty}>No custom items yet.</Text> : null}

        {customItems.map((item) => (
          <View key={item.id} style={styles.customRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customName}>{item.name}</Text>
              <MoneyInput currency={currency} value={String(item.amount)} onChangeValue={(v) => onChangeCustomAmount(item.id, v)} />
            </View>
            <Pressable
              style={[styles.deleteBtn, deletingId === item.id && styles.disabled]}
              onPress={() => onDeleteCustom(item.id)}
              disabled={deletingId === item.id}
            >
              <Text style={styles.deleteTxt}>Delete</Text>
            </Pressable>
          </View>
        ))}

        {customItems.length > 0 ? (
          <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={onSaveCustomAmounts} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>Save custom amounts</Text>}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add sacrifice item</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.typePill, newType === option.key && styles.typePillActive]}
              onPress={() => onSetNewType(option.key)}
            >
              <Text style={[styles.typeTxt, newType === option.key && styles.typeTxtActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {newType === "custom" ? (
          <>
            <Text style={styles.label}>Custom name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={onSetNewName}
              placeholder="Enter custom sacrifice name"
              placeholderTextColor={T.textMuted}
            />
          </>
        ) : null}

        <Text style={styles.label}>Amount ({currency})</Text>
        <MoneyInput currency={currency} value={newAmount} onChangeValue={onSetNewAmount} placeholder="0.00" />

        <Pressable style={[styles.saveBtn, creating && styles.disabled]} onPress={onCreateCustom} disabled={creating}>
          {creating ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>Add item</Text>}
        </Pressable>
      </View>
    </View>
  );
}
