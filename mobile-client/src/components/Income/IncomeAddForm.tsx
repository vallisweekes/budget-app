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
import { T } from "@/lib/theme";

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
          <ActivityIndicator size="small" color={T.onAccent} />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={17} color={T.onAccent} />
            <Text style={s.btnText}>Add Source</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 14,
    marginVertical: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
  },
  title: { color: "#0f282f", fontWeight: "900", fontSize: 15 },
  row: { flexDirection: "row", gap: 10 },
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
  btn: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  btnText: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.45 },
});
