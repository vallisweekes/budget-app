import React, { useRef } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, InputAccessoryView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import type { IncomeEditRowProps, IncomeRowProps } from "@/types";
import { styles } from "./styles";

/* ── Display row ─────────────────────────────────────────────── */

export function IncomeRow({ item, currency, onPress }: IncomeRowProps) {
  const isPressable = typeof onPress === "function";
  const amount = Number(item.amount ?? 0);
  const normalizedName = String(item.name ?? "").trim().toLowerCase();
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
            {item.name}
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
  const hiddenAccessoryIdRef = useRef(`income-source-hidden-accessory-${Math.random().toString(36).slice(2)}`);
  const hiddenAccessoryId = Platform.OS === "ios" ? hiddenAccessoryIdRef.current : undefined;

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
        />
        <TextInput
          style={[styles.input, { width: 100 }]}
          value={editAmount}
          onChangeText={setEditAmount}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor={T.textMuted}
          returnKeyType="done"
          inputAccessoryViewID={hiddenAccessoryId}
          onSubmitEditing={onSave}
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
      {hiddenAccessoryId ? (
        <InputAccessoryView nativeID={hiddenAccessoryId} backgroundColor="transparent">
          <View style={{ height: 1 }} />
        </InputAccessoryView>
      ) : null}
    </View>
  );
}
