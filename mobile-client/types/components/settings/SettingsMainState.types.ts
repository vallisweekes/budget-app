export type SettingsMainStateMode = "loading" | "error" | "noPlan";

export type SettingsMainStateProps = {
  mode: SettingsMainStateMode;
  errorMessage?: string;
  retryButtonLabel: string;
  noPlanTitle: string;
  noPlanMessage: string;
  createButtonLabel: string;
  createDisabled: boolean;
  onRetry: () => void;
  onCreatePlan: () => void;
};
