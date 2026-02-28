import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";

type Props = {
  visible: boolean;
  currency: string;
  payAmount: string;
  paying: boolean;
  onChangeAmount: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onMarkPaid: () => void;
};

export default function PaymentSheet({
  visible,
  currency,
  payAmount,
  paying,
  onChangeAmount,
  onClose,
  onSave,
  onMarkPaid,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.sheetBackdrop} onPress={onClose} />
        <View style={s.paySheetCard}>
          <View style={s.sheetHandle} />
          <Text style={s.sectionTitle}>Make Payment</Text>

          <View style={s.payInputGroup}>
            <Text style={s.inputLabel}>Manual payment amount ({currency})</Text>
            <MoneyInput
              currency={currency}
              value={payAmount}
              onChangeValue={onChangeAmount}
              placeholder="0.00"
              inputStyle={{ fontSize: 28 }}
            />
          </View>

          <View style={s.sheetActions}>
            <Pressable onPress={onClose} style={[s.cancelBtn, paying && s.disabled]}>
              <Text style={s.cancelBtnTxt}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSave} disabled={paying} style={[s.saveBtn, s.saveBtnFlex, paying && s.disabled]}>
              {paying ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Save payment</Text>}
            </Pressable>
          </View>

          <Pressable onPress={onMarkPaid} disabled={paying} style={[s.markPaidBtn, paying && s.disabled]}>
            <Text style={s.markPaidBtnTxt}>Mark as paid</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  inputLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  paySheetCard: {
    backgroundColor: T.card,
    height: "62%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: T.border },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelBtn: { backgroundColor: T.cardAlt, borderRadius: 8, paddingVertical: 11, alignItems: "center", flex: 1 },
  cancelBtnTxt: { color: T.textDim, fontWeight: "700", fontSize: 14 },
  saveBtn: { backgroundColor: T.accent, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  saveBtnFlex: { flex: 1 },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },
  payInputGroup: { gap: 10, marginTop: 2 },
  payInput: {
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: T.text,
    fontSize: 28,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: T.border,
  },
  markPaidBtn: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${T.green}88`,
    backgroundColor: `${T.green}22`,
    paddingVertical: 12,
    alignItems: "center",
  },
  markPaidBtnTxt: { color: T.green, fontSize: 14, fontWeight: "800" },
});
