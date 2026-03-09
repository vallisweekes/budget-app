import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { styles } from "./styles";

import type { SettingsIosDatePickerModalProps } from "@/types/components/settings/SettingsIosDatePickerModal.types";

export default function SettingsIosDatePickerModal({ visible, draftDate, onCancel, onDone, onChangeDraftDate }: SettingsIosDatePickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onCancel}>
      <View style={styles.dateModalOverlay}>
        <Pressable style={styles.dateModalBackdrop} onPress={onCancel} />
        <View style={styles.dateModalSheet}>
          <View style={styles.dateModalHeader}>
            <Pressable onPress={onCancel}><Text style={styles.dateModalCancelTxt}>Cancel</Text></Pressable>
            <Pressable onPress={onDone}><Text style={styles.dateModalDoneTxt}>Done</Text></Pressable>
          </View>
          <DateTimePicker
            value={draftDate}
            mode="date"
            display="inline"
            themeVariant="dark"
            minimumDate={new Date()}
            onChange={(event, selectedDate) => {
              const next = selectedDate ?? (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
              if (next) onChangeDraftDate(next);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
