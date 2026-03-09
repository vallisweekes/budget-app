import React from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";

import type { PaymentSheetProps } from "@/types";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import { useSwipeDownToClose } from "@/hooks";
import { styles } from "./styles";

export default function PaymentSheet({
  visible,
  currency,
  payAmount,
  paying,
  onChangeAmount,
  onClose,
  onSave,
  onMarkPaid,
  showMarkPaid = true,
  markPaidLabel = "Mark due as paid",
}: PaymentSheetProps) {
  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: paying });

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <Animated.View style={[styles.paySheetCard, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <Text style={styles.sectionTitle}>Record a payment</Text>

          <View style={styles.payInputGroup}>
            <Text style={styles.inputLabel}>How much did you pay?</Text>
            <MoneyInput
              currency={currency}
              value={payAmount}
              onChangeValue={onChangeAmount}
              placeholder="0.00"
            />
          </View>

          {showMarkPaid && onMarkPaid ? (
            <Pressable onPress={onMarkPaid} disabled={paying} style={[styles.markPaidBtn, paying && styles.disabled]}>
              <Text style={styles.markPaidBtnTxt}>{markPaidLabel}</Text>
            </Pressable>
          ) : null}

          <View style={styles.bottomActions}>
            <View style={styles.sheetActions}>
              <Pressable onPress={onClose} style={[styles.cancelBtn, paying && styles.disabled]}>
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onSave} disabled={paying} style={[styles.saveBtn, styles.saveBtnFlex, paying && styles.disabled]}>
                {paying ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>Save payment</Text>}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
