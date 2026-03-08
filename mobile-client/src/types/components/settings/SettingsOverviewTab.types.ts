export type SettingsOverviewTabProps = {
  email: string;
  payDateLabel: string;
  payFrequencyLabel: string;
  currencyLabel: string;
  notificationsLabel: string;
  versionLabel: string;
  onEditProfile: () => void;
  onOpenBudget: () => void;
  onOpenIncomeSettings: () => void;
  onOpenSavings: () => void;
  onOpenPlans: () => void;
  onOpenLocale: () => void;
  onOpenNotifications: () => void;
  onOpenDanger: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
};