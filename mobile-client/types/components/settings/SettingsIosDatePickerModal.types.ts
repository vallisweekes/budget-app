export type SettingsIosDatePickerModalProps = {
  visible: boolean;
  draftDate: Date;
  onCancel: () => void;
  onDone: () => void;
  onChangeDraftDate: (value: Date) => void;
};
