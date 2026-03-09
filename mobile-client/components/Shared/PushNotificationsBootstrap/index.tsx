import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/context/AuthContext";
import { registerBackgroundNotificationTaskAsync } from "@/lib/backgroundNotifications";
import {
  configureNotificationsBootstrapAsync,
  registerExpoPushToken,
  sendInstallWelcomeNotificationOnceAsync,
} from "@/lib/pushNotifications";
import { appendNotificationInboxItem } from "@/lib/notificationInbox";
import { openIncomeSacrificeFromReminder } from "@/navigation/navigationRef";

type NotificationData = {
  type?: unknown;
  month?: unknown;
  year?: unknown;
  budgetPlanId?: unknown;
};

export function PushNotificationsBootstrap() {
  const { token, username, isLoading } = useAuth();
  const handledIdentifiersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void configureNotificationsBootstrapAsync();
    void registerBackgroundNotificationTaskAsync();
    void sendInstallWelcomeNotificationOnceAsync();
  }, []);

  useEffect(() => {
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (isLoading || !token) return;

      void registerExpoPushToken({ username: username && username.trim() ? username : "mobile-user" });
    });

    return () => {
      appStateSub.remove();
    };
  }, [isLoading, token, username]);

  const handleReminderOpen = (identifier: string, data: NotificationData) => {
    if (handledIdentifiersRef.current.has(identifier)) return;

    const type = typeof data.type === "string" ? data.type : "";
    if (type !== "income_sacrifice_reminder") return;

    const didOpen = openIncomeSacrificeFromReminder({
      month: data.month,
      year: data.year,
      budgetPlanId: data.budgetPlanId,
    });
    if (didOpen) {
      handledIdentifiersRef.current.add(identifier);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!token) return;
    void (async () => {
      try {
        await registerExpoPushToken({ username: username && username.trim() ? username : "mobile-user" });
      } catch (e) {
        if (__DEV__) {
           
          console.warn("[push] registration failed", e);
        }
      }
    })();
  }, [isLoading, token, username]);

  useEffect(() => {
    if (isLoading || !token) return;

    const sub = Notifications.addPushTokenListener(() => {
      // In rare cases the underlying device token can roll; re-register to keep
      // our backend in sync. `registerExpoPushToken` de-dupes using storage.
      void registerExpoPushToken({ username: username && username.trim() ? username : "mobile-user" });
    });

    return () => sub.remove();
  }, [isLoading, token, username]);

  useEffect(() => {
    if (isLoading || !token) return;

    const appendFromNotification = (notification: {
      request?: { identifier?: string; content?: { title?: string | null; body?: string | null } };
    }) => {
      const identifier = notification?.request?.identifier;
      const title = notification?.request?.content?.title ?? "BudgetIn Check";
      const body = notification?.request?.content?.body ?? "";
      void appendNotificationInboxItem({
        id: typeof identifier === "string" ? identifier : null,
        title,
        body,
      });
    };

    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      const identifier = response?.notification.request.identifier;
      const data = (response?.notification.request.content.data ?? {}) as NotificationData;
      if (!identifier) return;

      appendFromNotification(response.notification);
      handleReminderOpen(identifier, data);
    })();

    const received = Notifications.addNotificationReceivedListener((event) => {
      appendFromNotification(event);
    });

    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const identifier = event.notification.request.identifier;
      const data = (event.notification.request.content.data ?? {}) as NotificationData;
      appendFromNotification(event.notification);
      handleReminderOpen(identifier, data);
    });

    const dropped = Notifications.addNotificationsDroppedListener(() => {
      if (__DEV__) {
        console.warn("[push] one or more notifications were dropped by FCM");
      }
    });

    return () => {
      received.remove();
      response.remove();
      dropped.remove();
    };
  }, [isLoading, token]);

  return null;
}
