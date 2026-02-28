import React from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { T } from "@/lib/theme";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";

type Props = {
  visible: boolean;
  saving: boolean;
  name: string;
  interestRate: string;
  monthlyPayment: string;
  monthlyMinimum: string;
  dueDay: string;
  dueDate: string;
  installment: string;
  autoPay: boolean;
  showDatePicker: boolean;
  onClose: () => void;
  onSave: () => void;
  onChangeName: (v: string) => void;
  onChangeRate: (v: string) => void;
  onChangeMonthlyPayment: (v: string) => void;
  onChangeMin: (v: string) => void;
  onChangeDueDay: (v: string) => void;
  onPickDate: () => void;
  onDateChange: (value: string) => void;
  onToggleAutoPay: (v: boolean) => void;
  onChangeInstallment: (v: string) => void;
  onSetShowDatePicker: (v: boolean) => void;
};

export default function EditDebtSheet(props: Props) {
  const {
    visible, saving, name, interestRate, monthlyPayment, monthlyMinimum, dueDay, dueDate, installment, autoPay, showDatePicker,
    onClose, onSave, onChangeName, onChangeRate, onChangeMonthlyPayment, onChangeMin, onChangeDueDay,
    onPickDate, onDateChange, onToggleAutoPay, onChangeInstallment, onSetShowDatePicker,
  } = props;

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: saving });

  const iosDueDateBeforeRef = React.useRef<string>("");
  const [iosDueDateDraft, setIosDueDateDraft] = React.useState<Date>(new Date());

  React.useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!showDatePicker) return;
    iosDueDateBeforeRef.current = dueDate;
    setIosDueDateDraft(dueDate ? new Date(`${dueDate}T00:00:00`) : new Date());
  }, [showDatePicker, dueDate]);

  const cancelDueDatePicker = React.useCallback(() => {
    onSetShowDatePicker(false);
    if (iosDueDateBeforeRef.current !== dueDate) onDateChange(iosDueDateBeforeRef.current);
  }, [dueDate, onDateChange, onSetShowDatePicker]);

  const closeDueDatePicker = React.useCallback(() => {
    onDateChange(iosDueDateDraft.toISOString().slice(0, 10));
    onSetShowDatePicker(false);
  }, [iosDueDateDraft, onDateChange, onSetShowDatePicker]);

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.sheetBackdrop} onPress={onClose} />
        <Animated.View style={[s.sheetCard, { transform: [{ translateY: dragY }] }]}>
          <View style={s.sheetHandle} {...panHandlers} />
          <Text style={s.sectionTitle}>Edit Debt</Text>

          <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetScrollContent} showsVerticalScrollIndicator={false}>
            <View style={s.formGroup}>
              <Text style={s.inputLabel}>Name</Text>
              <TextInput style={s.input} value={name} onChangeText={onChangeName} placeholderTextColor={T.textMuted} />
            </View>

            <View style={s.formRow}>
              <View style={s.formGroup}><Text style={s.inputLabel}>Interest Rate %</Text><TextInput style={s.input} value={interestRate} onChangeText={onChangeRate} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} /></View>
              <View style={s.formGroup}><Text style={s.inputLabel}>Monthly payment</Text><TextInput style={s.input} value={monthlyPayment} onChangeText={onChangeMonthlyPayment} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} /></View>
            </View>

            <View style={s.formGroup}>
              <Text style={s.inputLabel}>Min Monthly (optional)</Text>
              <TextInput style={s.input} value={monthlyMinimum} onChangeText={onChangeMin} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} />
            </View>

            <View style={s.formRow}>
              <View style={s.formGroup}><Text style={s.inputLabel}>Due day (1-31)</Text><TextInput style={s.input} value={dueDay} onChangeText={onChangeDueDay} keyboardType="number-pad" placeholder="e.g. 15" placeholderTextColor={T.textMuted} /></View>
              <View style={s.formGroup}>
                <Text style={s.inputLabel}>Due date (calendar)</Text>
                <TouchableOpacity style={s.input} onPress={onPickDate}><Text style={[s.dateValue, !dueDate && s.dateValuePlaceholder]}>{dueDate ? dueDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1") : "Select date"}</Text></TouchableOpacity>
              </View>
            </View>

            {showDatePicker ? (
              <View style={{ marginBottom: 12 }}>
                {Platform.OS === "android" ? (
                  <DateTimePicker
                    value={dueDate ? new Date(`${dueDate}T00:00:00`) : new Date()}
                    mode="date"
                    display="calendar"
                    onChange={(event, selectedDate) => {
                      onSetShowDatePicker(false);
                      if (event.type === "set" && selectedDate) onDateChange(selectedDate.toISOString().slice(0, 10));
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            {Platform.OS === "ios" ? (
              <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                presentationStyle="overFullScreen"
                onRequestClose={cancelDueDatePicker}
              >
                <View style={s.dateModalOverlay}>
                  <Pressable style={s.dateModalBackdrop} onPress={cancelDueDatePicker} />
                  <View style={s.dateModalSheet}>
                    <View style={s.dateModalHeader}>
                      <Pressable onPress={cancelDueDatePicker}>
                        <Text style={s.dateModalCancelTxt}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={closeDueDatePicker}>
                        <Text style={s.dateModalDoneTxt}>Done</Text>
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={iosDueDateDraft}
                      mode="date"
                      display="inline"
                      onChange={(event, selectedDate) => {
                        const next =
                          selectedDate ??
                          // Some iOS inline picker versions only provide a timestamp on the event.
                          (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                        if (next) setIosDueDateDraft(next);
                      }}
                    />
                  </View>
                </View>
              </Modal>
            ) : null}

            <View style={s.switchRow}>
              <Text style={s.inputLabel}>Direct debit / standing order</Text>
              <Switch
                value={autoPay}
                onValueChange={onToggleAutoPay}
                trackColor={{ false: T.border, true: `${T.accent}66` }}
                thumbColor={autoPay ? T.accent : T.textMuted}
              />
            </View>

            <Text style={s.inputLabel}>Spread over months</Text>
            <View style={s.installmentRow}>
              {[0, 3, 6, 12, 24, 36].map((months) => {
                const active = (installment || "0") === String(months);
                return (
                  <Pressable key={months} onPress={() => onChangeInstallment(months === 0 ? "" : String(months))} style={[s.installmentChip, active && s.installmentChipActive]}>
                    <Text style={[s.installmentChipText, active && s.installmentChipTextActive]}>{months === 0 ? "None" : `${months} months`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={s.sheetActions}>
            <Pressable onPress={onClose} style={[s.cancelBtn, saving && s.disabled]}><Text style={s.cancelBtnTxt}>Cancel</Text></Pressable>
            <Pressable onPress={onSave} disabled={saving} style={[s.saveBtn, s.saveBtnFlex, saving && s.disabled]}>
              {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  inputLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  dateModalOverlay: { flex: 1, justifyContent: "flex-end" },
  dateModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  dateModalSheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingBottom: 16,
    overflow: "hidden",
  },
  dateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  dateModalCancelTxt: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  dateModalDoneTxt: { color: T.accent, fontSize: 14, fontWeight: "800" },
  sheetCard: { backgroundColor: T.card, height: "88%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 14 },
  sheetScroll: { flex: 1, minHeight: 0 },
  sheetScrollContent: { gap: 10, paddingBottom: 8, flexGrow: 1 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: T.border },
  formGroup: { flex: 1, gap: 8 },
  formRow: { flexDirection: "row", gap: 12, marginBottom: 2 },
  input: { backgroundColor: T.cardAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.border },
  dateValue: { color: T.text, fontSize: 14 },
  dateValuePlaceholder: { color: T.textMuted },
  dateDoneBtn: { marginTop: 8 },
  switchRow: { marginTop: 2, marginBottom: 16, padding: 12, borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.cardAlt, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  installmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, marginBottom: 10 },
  installmentChip: { borderWidth: 1, borderColor: T.border, backgroundColor: T.cardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  installmentChipActive: { borderColor: T.accent, backgroundColor: `${T.accent}2A` },
  installmentChipText: { color: T.textDim, fontSize: 12, fontWeight: "700" },
  installmentChipTextActive: { color: T.accent, fontWeight: "800" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelBtn: { backgroundColor: T.cardAlt, borderRadius: 8, paddingVertical: 11, alignItems: "center", flex: 1 },
  cancelBtnTxt: { color: T.textDim, fontWeight: "700", fontSize: 14 },
  saveBtn: { backgroundColor: T.accent, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  saveBtnFlex: { flex: 1 },
  saveBtnTxt: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },
});
