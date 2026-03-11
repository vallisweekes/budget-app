import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";

import { apiFetch } from "@/lib/api";
import {
  subscribeNotificationInbox,
  type NotificationInboxItem,
} from "@/lib/notificationInbox";
import type { NotificationPrefs, NotificationPrefsResponse } from "@/types/settings";

const NOTIFICATION_PREFS_KEY = "budget_app.notification_prefs";

export function useSettingsNotifications(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    dueReminders: true,
    paymentAlerts: true,
    dailyTips: true,
  });
  const [notificationInbox, setNotificationInbox] = useState<NotificationInboxItem[]>([]);

  const loadNotifications = useCallback(async () => {
    const readFromSecureStore = async () => {
      try {
        const raw = await SecureStore.getItemAsync(NOTIFICATION_PREFS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as NotificationPrefs;
        if (
          typeof parsed?.dueReminders === "boolean" &&
          typeof parsed?.paymentAlerts === "boolean" &&
          typeof parsed?.dailyTips === "boolean"
        ) {
          setNotifications(parsed);
        }
      } catch {
        // ignore
      }
    };

    try {
      const remote = await apiFetch<NotificationPrefsResponse>("/api/bff/notifications/preferences", {
        cacheTtlMs: 0,
      });
      if (
        typeof remote?.dueReminders === "boolean" &&
        typeof remote?.paymentAlerts === "boolean" &&
        typeof remote?.dailyTips === "boolean"
      ) {
        const next = {
          dueReminders: remote.dueReminders,
          paymentAlerts: remote.paymentAlerts,
          dailyTips: remote.dailyTips,
        };
        setNotifications(next);
        await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
        return;
      }
    } catch {
      await readFromSecureStore();
    }
  }, []);

  const formatNotificationReceivedAt = useCallback((value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const saveNotifications = useCallback(async (next: NotificationPrefs) => {
    setNotifications(next);
    await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
    try {
      const remote = await apiFetch<NotificationPrefsResponse>("/api/bff/notifications/preferences", {
        method: "PUT",
        body: {
          dueReminders: next.dueReminders,
          paymentAlerts: next.paymentAlerts,
          dailyTips: next.dailyTips,
        },
      });

      if (
        typeof remote?.dueReminders === "boolean" &&
        typeof remote?.paymentAlerts === "boolean" &&
        typeof remote?.dailyTips === "boolean"
      ) {
        const synced = {
          dueReminders: remote.dueReminders,
          paymentAlerts: remote.paymentAlerts,
          dailyTips: remote.dailyTips,
        };
        setNotifications(synced);
        await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(synced));
      }
    } catch (err: unknown) {
      Alert.alert("Notification settings", err instanceof Error ? err.message : "Failed to sync settings.");
    }
  }, []);

  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (hasLoadedRemote) return;
    setHasLoadedRemote(true);
    void loadNotifications();
  }, [enabled, hasLoadedRemote, loadNotifications]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationInbox((snapshot) => {
      setNotificationInbox(snapshot.items);
    });
    return unsubscribe;
  }, []);

  return {
    notifications,
    notificationInbox,
    loadNotifications,
    formatNotificationReceivedAt,
    saveNotifications,
  };
}