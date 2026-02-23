import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

interface Props {
  name: string;
  amount: string;
  setName: (v: string) => void;
  setAmount: (v: string) => void;
  distributeMonths: boolean;
  setDistributeMonths: (v: boolean) => void;
  distributeYears: boolean;
  setDistributeYears: (v: boolean) => void;
  onAdd: () => void;
  saving: boolean;
}

export function IncomeAddForm({ name, amount, setName, setAmount, distributeMonths, setDistributeMonths, distributeYears, setDistributeYears, onAdd, saving }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Add Income Source</Text>
      <View style={s.row}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Salary, Freelance"
          placeholderTextColor={T.textMuted}
          autoFocus
          returnKeyType="next"
        />
        <TextInput
          style={[s.input, { width: 110 }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount"
          placeholderTextColor={T.textMuted}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
      </View>
      {/* Distribute remaining months */}
      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>Distribute remaining months</Text>
          <Text style={s.toggleSub}>Add to every month from now through December</Text>
        </View>
        <TouchableOpacity
          onPress={() => setDistributeMonths(!distributeMonths)}
          style={[s.toggle, distributeMonths && s.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[s.toggleThumb, distributeMonths && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      {/* Distribute across years */}
      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={s.toggleTitle}>Distribute across years</Text>
          <Text style={s.toggleSub}>Also add to the same period next year</Text>
        </View>
        <TouchableOpacity
          onPress={() => setDistributeYears(!distributeYears)}
          style={[s.toggle, distributeYears && s.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[s.toggleThumb, distributeYears && s.toggleThumbOn]} />
        </TouchableOpacity>
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
    ...cardBase,
    padding: 14,
    marginHorizontal: 14,
    marginVertical: 8,
    gap: 10,
    borderColor: T.accentFaint,
  },
  title: { color: T.text, fontWeight: "900", fontSize: 15 },
  row: { flexDirection: "row", gap: 10 },
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

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: T.text, fontSize: 13, fontWeight: "800" },
  toggleSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: T.accent + "55",
    borderColor: T.accent,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.textMuted,
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    backgroundColor: T.accent,
    alignSelf: "flex-end",
  },
});
