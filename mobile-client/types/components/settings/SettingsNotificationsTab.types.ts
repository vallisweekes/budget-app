import type { NotificationInboxItem } from "@/lib/notificationInbox";
import type { NotificationPrefs } from "@/types/settings";

export type SettingsNotificationsTabProps = {
  notifications: NotificationPrefs;
  inbox: NotificationInboxItem[];
  formatReceivedAt: (value: string) => string;
  onSaveNotifications: (next: NotificationPrefs) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
};
