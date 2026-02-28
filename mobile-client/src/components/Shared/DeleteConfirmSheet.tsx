import React from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { T } from "@/lib/theme";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";

type Props = {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmSheet({
  visible,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  isBusy = false,
  onClose,
  onConfirm,
}: Props) {
  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: isBusy });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={() => !isBusy && onClose()} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: dragY }] }]}>
          <View style={s.handle} {...panHandlers} />
          <Text style={s.title}>{title}</Text>
          <Text style={s.description}>{description}</Text>

          <View style={s.actions}>
            <Pressable style={[s.cancelBtn, isBusy && s.disabled]} onPress={onClose} disabled={isBusy}>
              <Text style={s.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable style={[s.deleteBtn, isBusy && s.disabled]} onPress={onConfirm} disabled={isBusy}>
              <Text style={s.deleteText}>{confirmText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: T.border,
  },
  title: { color: T.text, fontSize: 16, fontWeight: "900" },
  description: { color: T.textDim, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingVertical: 11,
    alignItems: "center",
  },
  deleteBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    backgroundColor: `${T.red}22`,
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelText: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  deleteText: { color: T.red, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
