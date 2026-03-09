export type DeleteConfirmSheetProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};