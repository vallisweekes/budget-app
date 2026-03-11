export type SettingsLinkRowProps = {
  label: string;
  value?: string | null;
  valueColor?: string;
  onPress: () => void;
  danger?: boolean;
};