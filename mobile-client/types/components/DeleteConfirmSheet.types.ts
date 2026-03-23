export type DeleteConfirmSheetProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  confirmHint?: string;
  secondaryConfirmText?: string;
  secondaryConfirmHint?: string;
  cancelText?: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSecondaryConfirm?: () => void;
};