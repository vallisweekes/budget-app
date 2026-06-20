export type SettingsOverviewTabProps = {
  profileName: string;
  avatarUrl?: string | null;
  onPressAvatar: () => void;
  onOpenPersonal: () => void;
  onOpenBudget: () => void;
  onOpenSavings: () => void;
  onOpenPreferences: () => void;
  onSignOut: () => void;
};