import type { SubscriptionSummaryResponse } from "@/lib/apiTypes";

export type SettingsSubscriptionTabProps = {
  subscription: SubscriptionSummaryResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};