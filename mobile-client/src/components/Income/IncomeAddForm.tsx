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

interface Props {
  name: string;
  amount: string;
  setName: (v: string) => void;
  setAmount: (v: string) => void;
  onAdd: () => void;
  saving: boolean;
}

export function IncomeAddForm({ name, amount, setName, setAmount, onAdd, saving }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Add Income Source</Text>
      <View style={s.row}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Salary, Freelance"
          placeholderTextColor="#4a5568"
          autoFocus
          returnKeyType="next"
        />
        <TextInput
          style={[s.input, { width: 110 }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount"
          placeholderTextColor="#4a5568"
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
      </View>
      <Pressable
        onPress={onAdd}
        disabled={saving || !name.trim() || !amount.trim()}
        style={[
          s.btn,
          (saving || !name.trim() || !amount.trim()) && s.disabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#061b1c" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={17} color="#061b1c" />
            <Text style={s.btnText}>Add Source</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: "#0a1e23",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 14,
    marginVertical: 8,
    gap: 10,
  },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  row: { flexDirection: "row", gap: 10 },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  btn: {
    backgroundColor: "#02eff0",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  btnText: { color: "#061b1c", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.45 },
});
