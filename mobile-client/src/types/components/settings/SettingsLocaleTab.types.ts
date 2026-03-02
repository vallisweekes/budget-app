export type SettingsLocaleTabProps = {
  country: string;
  language?: string | null;
  currency?: string | null;
  detectedCountry: string | null;
  onEdit: () => void;
  onUseDetected: () => void;
  canUseDetected: boolean;
};
