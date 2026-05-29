import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PaymentSheetProps } from "@/types";
import MoneyInput from "@/components/Shared/MoneyInput";
import GlassFooterButton from "@/components/Shared/GlassFooterButton";
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
  const insets = useSafeAreaInsets();
  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: paying }); const parsedPayAmount = Number.parseFloat(payAmount);
  const canSave = Number.isFinite(parsedPayAmount) && parsedPayAmount > 0 && !paying;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (!paying) onClose();
      }}
    >
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} disabled={paying} />
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
              editable={!paying}
            />
          </View>

          {showMarkPaid && onMarkPaid ? (
            <Pressable onPress={onMarkPaid} disabled={paying} style={[styles.markPaidBtn, paying && styles.disabled]}>
              <Text style={styles.markPaidBtnTxt}>{markPaidLabel}</Text>
            </Pressable>
          ) : null}

          <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 28 }]}> 
            <View style={styles.sheetActions}>
              <GlassFooterButton
                label="Cancel"
                onPress={onClose}
                disabled={paying}
                variant="dark"
                tone="light"
                containerStyle={styles.actionBtn}
              />
              <GlassFooterButton
                label="Save payment"
                onPress={onSave}
                disabled={!canSave}
                loading={paying}
                variant="light"
                tone="dark"
                containerStyle={styles.actionBtn}
              />
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
