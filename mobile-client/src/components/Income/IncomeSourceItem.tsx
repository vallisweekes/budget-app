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

/* ── Display row ─────────────────────────────────────────────── */

interface RowProps {
  item: Income;
  currency: string;
  fmt: (v: number | string | null | undefined, c: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}

export function IncomeRow({ item, currency, fmt, onEdit, onDelete }: RowProps) {
  return (
    <View style={s.row}>
      <View style={s.dot} />
      <Pressable style={s.info} onPress={onEdit}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.hint}>Tap to edit</Text>
      </Pressable>
      <Text style={s.amount}>{fmt(item.amount, currency)}</Text>
      <Pressable onPress={onDelete} hitSlop={8} style={s.del}>
        <Ionicons name="trash-outline" size={18} color="#e25c5c" />
      </Pressable>
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
          placeholderTextColor="#4a5568"
          autoFocus
        />
        <TextInput
          style={[s.input, { width: 100 }]}
          value={editAmount}
          onChangeText={setEditAmount}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor="#4a5568"
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
            <ActivityIndicator size="small" color="#fff" />
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
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,40,47,0.08)",
    gap: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3ec97e" },
  info: { flex: 1, minWidth: 0 },
  name: { color: "#0f282f", fontSize: 15, fontWeight: "800" },
  hint: { color: "rgba(15,40,47,0.45)", fontSize: 11, marginTop: 2, fontWeight: "600" },
  amount: { color: "#0f282f", fontSize: 15, fontWeight: "900" },
  del: { padding: 4 },

  editWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  editInputs: { flexDirection: "row", gap: 10 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  input: {
    backgroundColor: "rgba(15,40,47,0.06)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f282f",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(15,40,47,0.06)",
  },
  cancelText: { color: "rgba(15,40,47,0.65)", fontWeight: "700", fontSize: 13 },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#02eff0" },
  saveText: { color: "#061b1c", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
});
