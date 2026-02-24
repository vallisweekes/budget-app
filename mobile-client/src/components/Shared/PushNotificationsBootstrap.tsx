import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/context/AuthContext";
import { registerExpoPushToken } from "@/lib/pushNotifications";

export function PushNotificationsBootstrap() {
  const { token, username, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!token || !username) return;
    void (async () => {
      try {
        await registerExpoPushToken({ username });
      } catch (e) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[push] registration failed", e);
        }
      }
    })();
  }, [isLoading, token, username]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      // no-op for now (foreground receipt)
    });

    const response = Notifications.addNotificationResponseReceivedListener(() => {
      // no-op for now (tap/open)
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, []);

  return null;
}
