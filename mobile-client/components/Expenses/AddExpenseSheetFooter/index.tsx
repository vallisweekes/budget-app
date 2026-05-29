import React from "react";
import { Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles as s } from "@/components/Expenses/AddExpenseSheet/styles";

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
        style={({ pressed }) => [s.submitBtn, pressed && s.submitBtnPressed, (!canSubmit || submitting) && s.submitDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit || submitting}
      >
        <BlurView intensity={34} tint="light" style={s.submitBtnGlass}>
          <View style={s.submitBtnTint} pointerEvents="none" />
          <View style={s.submitBtnGlow} pointerEvents="none" />
          <View style={s.submitBtnInnerBorder} pointerEvents="none" />
          {submitting ? <Text style={s.submitTxt}>Adding…</Text> : <Text style={s.submitTxt}>Add Expense</Text>}
        </BlurView>
      </Pressable>
    </>
  );
}
