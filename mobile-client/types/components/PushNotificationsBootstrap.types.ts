export type NotificationData = {
  type?: unknown;
  month?: unknown;
  year?: unknown;
  budgetPlanId?: unknown;
};

export type PushNotificationInboxEvent = {
  request?: {
    identifier?: string;
    content?: {
      title?: string | null;
      body?: string | null;
    };
  };
};