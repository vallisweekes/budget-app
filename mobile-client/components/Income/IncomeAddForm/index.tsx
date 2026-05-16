import React from "react";
import { View, Text, Pressable, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import { styles } from "./styles";
import type { IncomeAddFormProps } from "@/types";

const SHEET_BLUE = "#080080";

export function IncomeAddForm({ currency, name, amount, setName, setAmount, distributeMonths, setDistributeMonths, distributeYears, setDistributeYears, onAdd, saving }: IncomeAddFormProps) {
  const isDisabled = saving || !name.trim() || !amount.trim();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Add Income Source</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Salary, Freelance"
          placeholderTextColor={T.textMuted}
          autoFocus
          returnKeyType="next"
        />
        <MoneyInput
          currency={currency}
          value={amount}
          onChangeValue={setAmount}
          placeholder="0.00"
          containerStyle={{ width: 150 }}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
      </View>
      {/* Distribute remaining months */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>Distribute remaining months</Text>
          <Text style={styles.toggleSub}>Add to every month from now through December</Text>
        </View>
        <TouchableOpacity
          onPress={() => setDistributeMonths(!distributeMonths)}
          style={[styles.toggle, distributeMonths && styles.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[styles.toggleThumb, distributeMonths && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      {/* Distribute across years */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>Distribute across years</Text>
          <Text style={styles.toggleSub}>Also add to the same period next year</Text>
        </View>
        <TouchableOpacity
          onPress={() => setDistributeYears(!distributeYears)}
          style={[styles.toggle, distributeYears && styles.toggleOn]}
          activeOpacity={0.8}
        >
          <View style={[styles.toggleThumb, distributeYears && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      <Pressable
        onPress={onAdd}
        disabled={isDisabled}
        style={[
          styles.btn,
          isDisabled && styles.btnDisabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color={SHEET_BLUE} />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={17} color={isDisabled ? "rgba(8, 0, 128, 0.45)" : SHEET_BLUE} />
            <Text style={[styles.btnText, isDisabled && styles.btnTextDisabled]}>Add Source</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
