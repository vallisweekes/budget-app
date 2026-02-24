import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { s } from "@/components/Expenses/AddExpenseSheet.styles";

export default function AddExpenseSheetFooter({
  error,
  canSubmit,
  submitting,
  onSubmit,
}: {
  error: string | null;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {error ? (
        <View style={s.errorRow}>
          <Ionicons name="warning-outline" size={14} color={T.red} />
          <Text style={s.errorTxt}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={[s.submitBtn, (!canSubmit || submitting) && s.submitDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? (
          <Text style={s.submitTxt}>Adding…</Text>
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={18} color={T.onAccent} />
            <Text style={s.submitTxt}>Add Expense</Text>
          </>
        )}
      </Pressable>
    </>
  );
}
