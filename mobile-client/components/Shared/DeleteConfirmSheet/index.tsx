import React from "react";
import { Animated, Modal, Pressable, Text, View } from "react-native";

import type { DeleteConfirmSheetProps } from "@/types";
import { useSwipeDownToClose } from "@/hooks";
import { styles } from "./styles";

export default function DeleteConfirmSheet({
  visible,
  title,
  description,
  confirmText = "Delete",
  confirmHint,
  secondaryConfirmText,
  secondaryConfirmHint,
  cancelText = "Cancel",
  isBusy = false,
  onClose,
  onConfirm,
  onSecondaryConfirm,
}: DeleteConfirmSheetProps) {
  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: isBusy });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={() => !isBusy && onClose()} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.handle} {...panHandlers} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {secondaryConfirmText && onSecondaryConfirm ? (
            <View style={styles.scopeActions}>
              <Pressable style={[styles.cancelBtnWide, isBusy && styles.disabled]} onPress={onClose} disabled={isBusy}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>

              <View style={styles.scopeChoiceRow}>
                <Pressable style={[styles.secondaryDeleteBtnWide, isBusy && styles.disabled]} onPress={onSecondaryConfirm} disabled={isBusy}>
                  <Text style={styles.secondaryDeleteText}>{secondaryConfirmText}</Text>
                  {secondaryConfirmHint ? <Text style={styles.secondaryDeleteHint}>{secondaryConfirmHint}</Text> : null}
                </Pressable>

                <Pressable style={[styles.deleteBtnWide, isBusy && styles.disabled]} onPress={onConfirm} disabled={isBusy}>
                  <Text style={styles.deleteText}>{confirmText}</Text>
                  {confirmHint ? <Text style={styles.deleteHint}>{confirmHint}</Text> : null}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable style={[styles.cancelBtn, isBusy && styles.disabled]} onPress={onClose} disabled={isBusy}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>
              <Pressable style={[styles.deleteBtn, isBusy && styles.disabled]} onPress={onConfirm} disabled={isBusy}>
                <Text style={styles.deleteText}>{confirmText}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
