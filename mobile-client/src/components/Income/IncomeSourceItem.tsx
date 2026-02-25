import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Income } from "@/lib/apiTypes";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

/* ── Display row ─────────────────────────────────────────────── */

interface RowProps {
  item: Income;
  currency: string;
  onPress?: () => void;
}

export function IncomeRow({ item, currency, onPress }: RowProps) {
  const isPressable = typeof onPress === "function";
  const amount = Number(item.amount ?? 0);

  return (
    <Pressable
      onPress={onPress}
      disabled={!isPressable}
      style={({ pressed }) => [s.card, pressed && isPressable && s.pressed]}
    >
      <View style={s.left}>
        <Text style={s.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={s.hint}>{fmt(amount, currency)}</Text>
      </View>

      <View style={s.right}>
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

interface EditProps {
  editName: string;
  editAmount: string;
  setEditName: (v: string) => void;
  setEditAmount: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function IncomeEditRow({
  editName,
  editAmount,
  setEditName,
  setEditAmount,
  onSave,
  onCancel,
  saving,
}: EditProps) {
  return (
    <View style={s.editWrap}>
      <View style={s.editInputs}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={editName}
          onChangeText={setEditName}
          placeholder="Name"
          placeholderTextColor={T.textMuted}
          autoFocus
        />
        <TextInput
          style={[s.input, { width: 100 }]}
          value={editAmount}
          onChangeText={setEditAmount}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor={T.textMuted}
          returnKeyType="done"
          onSubmitEditing={onSave}
        />
      </View>
      <View style={s.editActions}>
        <Pressable onPress={onCancel} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[s.saveBtn, saving && s.disabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={T.onAccent} />
          ) : (
            <Text style={s.saveText}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    ...cardBase,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginVertical: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  pressed: { opacity: 0.75 },
  left: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 15, fontWeight: "800" },
  hint: { color: T.textDim, fontSize: 11, marginTop: 2, fontWeight: "600" },
  right: {
    width: 20,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  editWrap: {
    ...cardBase,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 14,
    gap: 10,
    borderColor: T.accentFaint,
  },
  editInputs: { flexDirection: "row", gap: 10 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.cardAlt,
  },
  cancelText: { color: T.textDim, fontWeight: "700", fontSize: 13 },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: T.accent },
  saveText: { color: T.onAccent, fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
});
