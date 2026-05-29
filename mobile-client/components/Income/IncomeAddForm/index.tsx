import React from "react";
import { View, Text, Pressable, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import { styles } from "./styles";
import type { IncomeAddFormProps } from "@/types";

export function IncomeAddForm({ currency, name, amount, setName, setAmount, distributeMonths, setDistributeMonths, distributeYears, setDistributeYears, onAdd, saving }: IncomeAddFormProps) {
  const isDisabled = saving || !name.trim() || !amount.trim();
  const distributionSummary = distributeMonths && distributeYears
    ? "Repeat for the remaining months and the same period next year"
    : distributeMonths
      ? "Repeat through the rest of this year"
      : distributeYears
        ? "Repeat in the same period next year"
        : "Apply only to this pay period";

  return (
    <View style={styles.wrap}>
      <View style={styles.heroCard}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={12} color={T.onAccent} />
          <Text style={styles.badgeText}>Income composer</Text>
        </View>
        <Text style={styles.title}>Add Income Source</Text>
        <Text style={styles.subtitle}>
          Create a polished income stream for this pay period, then decide how far it should roll forward.
        </Text>
      </View>

      <View style={styles.fieldsCard}>
        <View style={styles.fieldRow}>
          <View style={[styles.fieldGroup, styles.nameField]}>
            <Text style={styles.fieldLabel}>Source name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Salary, Freelance"
              placeholderTextColor={T.textMuted}
              autoFocus
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <MoneyInput
              currency={currency}
              value={amount}
              onChangeValue={setAmount}
              placeholder="0.00"
              variant="underline"
              containerStyle={styles.moneyInput}
              inputStyle={styles.moneyInputText}
              returnKeyType="done"
              onSubmitEditing={onAdd}
            />
          </View>
        </View>

        <Text style={styles.fieldHint}>Keep the label short and recognizable so this period stays easy to scan.</Text>
      </View>

      <View style={styles.toggleStack}>
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeading}>
            <View style={styles.toggleIconWrap}>
              <Ionicons name="calendar-clear-outline" size={18} color={T.onAccent} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Distribute remaining months</Text>
              <Text style={styles.toggleSub}>Add to every month from now through December</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setDistributeMonths(!distributeMonths)}
            style={[styles.toggle, distributeMonths && styles.toggleOn]}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleThumb, distributeMonths && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.toggleLeading}>
            <View style={styles.toggleIconWrap}>
              <Ionicons name="repeat-outline" size={18} color={T.onAccent} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Distribute across years</Text>
              <Text style={styles.toggleSub}>Also add to the same period next year</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setDistributeYears(!distributeYears)}
            style={[styles.toggle, distributeYears && styles.toggleOn]}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleThumb, distributeYears && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </View>
      </View>

      <Pressable
        onPress={onAdd}
        disabled={isDisabled}
        style={[
          styles.btn,
          isDisabled && styles.btnDisabled,
        ]}
      >
        <View style={[styles.btnIconWrap, isDisabled && styles.btnIconWrapDisabled]}>
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="add" size={18} color={isDisabled ? "rgba(255,255,255,0.55)" : "#ffffff"} />
          )}
        </View>
        <View style={styles.btnCopy}>
          <Text style={[styles.btnText, isDisabled && styles.btnTextDisabled]}>
            {saving ? "Saving source..." : "Add Source"}
          </Text>
          <Text style={[styles.btnMeta, isDisabled && styles.btnMetaDisabled]}>{distributionSummary}</Text>
        </View>
      </Pressable>
    </View>
  );
}
