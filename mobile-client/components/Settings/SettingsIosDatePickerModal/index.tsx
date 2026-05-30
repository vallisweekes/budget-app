import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useAppTranslation } from "@/hooks";
import { styles } from "./styles";

import type { SettingsIosDatePickerModalProps } from "@/types/components/settings/SettingsIosDatePickerModal.types";

export default function SettingsIosDatePickerModal({ visible, draftDate, onCancel, onDone, onChangeDraftDate }: SettingsIosDatePickerModalProps) {
  const { t } = useAppTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onCancel}>
      <View style={styles.dateModalOverlay}>
        <Pressable style={styles.dateModalBackdrop} onPress={onCancel} />
        <View style={styles.dateModalSheet}>
          <View style={styles.dateModalHeader}>
            <Pressable onPress={onCancel}><Text style={styles.dateModalCancelTxt}>{t("common.cancel")}</Text></Pressable>
            <Pressable onPress={onDone}><Text style={styles.dateModalDoneTxt}>{t("common.done")}</Text></Pressable>
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
