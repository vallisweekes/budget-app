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
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

/* ── Display row ─────────────────────────────────────────────── */

interface RowProps {
  item: Income;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function IncomeRow({ item, currency, fmt, onEdit, onDelete }: RowProps) {
  const canEdit = typeof onEdit === "function";
  const canDelete = typeof onDelete === "function";

  return (
    <View style={s.row}>
      <View style={s.dot} />
      {canEdit ? (
        <Pressable style={s.info} onPress={onEdit}>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.hint}>Tap to edit</Text>
        </Pressable>
      ) : (
        <View style={s.info}>
          <Text style={s.name}>{item.name}</Text>
        </View>
      )}
      <Text style={s.amount}>{fmt(item.amount, currency)}</Text>
      {canDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={s.del}>
          <Ionicons name="trash-outline" size={18} color={T.red} />
        </Pressable>
      ) : (
        <View style={s.delSpacer} />
      )}
    </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.green },
  info: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 15, fontWeight: "800" },
  hint: { color: T.textDim, fontSize: 11, marginTop: 2, fontWeight: "600" },
  amount: { color: T.text, fontSize: 15, fontWeight: "900" },
  del: { padding: 4 },
  delSpacer: { width: 26 },

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
