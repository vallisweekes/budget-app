import React from "react";
import { Animated, Modal, Pressable, Text, View } from "react-native";

import type { DeleteConfirmSheetProps } from "@/types";
import { T } from "@/lib/theme";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import { styles } from "./styles";

export default function DeleteConfirmSheet({
  visible,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  isBusy = false,
  onClose,
  onConfirm,
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

          <View style={styles.actions}>
            <Pressable style={[styles.cancelBtn, isBusy && styles.disabled]} onPress={onClose} disabled={isBusy}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable style={[styles.deleteBtn, isBusy && styles.disabled]} onPress={onConfirm} disabled={isBusy}>
              <Text style={styles.deleteText}>{confirmText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
