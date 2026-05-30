import React, { useRef } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "@/hooks";
import { fmt } from "@/lib/formatting";
import { translateIncomeSourceName } from "@/lib/i18n";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import type { IncomeEditRowProps, IncomeRowProps } from "@/types";
import { styles } from "./styles";

/* ── Display row ─────────────────────────────────────────────── */

export function IncomeRow({ item, currency, onPress }: IncomeRowProps) {
  const { language } = useAppTranslation();
  const isPressable = typeof onPress === "function";
  const amount = Number(item.amount ?? 0);
  const normalizedName = String(item.name ?? "").trim().toLowerCase();
  const displayName = translateIncomeSourceName(item.name, language);
  const iconName = normalizedName.includes("salary")
    ? "cash-outline"
    : normalizedName.includes("bonus")
      ? "sparkles-outline"
      : "wallet-outline";
  const iconTone = normalizedName.includes("salary") ? T.accent : T.orange;

  return (
    <Pressable
      onPress={onPress}
      disabled={!isPressable}
      style={({ pressed }) => [styles.card, pressed && isPressable && styles.pressed]}
    >
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: `${iconTone}14`, borderColor: `${iconTone}33` }]}> 
          <Ionicons name={iconName} size={18} color={iconTone} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.hint}>{fmt(amount, currency)}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={isPressable ? T.textDim : T.textMuted}
        />
      </View>
    </Pressable>
  );
}

/* ── Edit row ───────────────────────────────────────────────── */

export function IncomeEditRow({
  editName,
  editAmount,
  setEditName,
  setEditAmount,
  onSave,
  onCancel,
  saving,
}: IncomeEditRowProps) {
  return (
    <View style={styles.editWrap}>
      <View style={styles.editInputs}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={editName}
          onChangeText={setEditName}
          placeholder="Name"
          placeholderTextColor={T.textMuted}
          autoFocus
          editable={!saving}
        />
        <MoneyInput
          currency={null}
          value={editAmount}
          onChangeValue={setEditAmount}
          placeholder="Amount"
          editable={!saving}
          containerStyle={styles.editAmountInput}
          inputStyle={styles.editAmountInputText}
        />
      </View>
      <View style={styles.editActions}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={T.onAccent} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
