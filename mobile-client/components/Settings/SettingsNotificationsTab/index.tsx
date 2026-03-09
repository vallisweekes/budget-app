import React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsSection from "@/components/Settings/SettingsSection";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsNotificationsTabProps } from "@/types/components/settings/SettingsNotificationsTab.types";

export default function SettingsNotificationsTab({
  notifications,
  inbox,
  formatReceivedAt,
  onSaveNotifications,
  onMarkRead,
  onDelete,
}: SettingsNotificationsTabProps) {
  return (
    <SettingsSection title="Notifications">
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Due reminders</Text>
        <Switch value={notifications.dueReminders} onValueChange={(value) => onSaveNotifications({ ...notifications, dueReminders: value })} trackColor={{ false: T.border, true: T.accentFaint }} thumbColor={notifications.dueReminders ? T.accent : T.card} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Payment alerts</Text>
        <Switch value={notifications.paymentAlerts} onValueChange={(value) => onSaveNotifications({ ...notifications, paymentAlerts: value })} trackColor={{ false: T.border, true: T.accentFaint }} thumbColor={notifications.paymentAlerts ? T.accent : T.card} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Daily tips</Text>
        <Switch value={notifications.dailyTips} onValueChange={(value) => onSaveNotifications({ ...notifications, dailyTips: value })} trackColor={{ false: T.border, true: T.accentFaint }} thumbColor={notifications.dailyTips ? T.accent : T.card} />
      </View>
      <Text style={[styles.muted, styles.notificationHeading]}>Recent notifications</Text>
      {inbox.length ? (
        <View style={styles.notificationList}>
          {inbox.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (item.readAt) return;
                onMarkRead(item.id);
              }}
              style={({ pressed }) => [styles.notificationItem, !item.readAt && styles.notificationItemUnread, pressed && styles.notificationItemPressed]}
            >
              <View style={styles.notificationTitleRow}>
                <Text style={styles.notificationTitle} numberOfLines={1}>{item.title || "BudgetIn Check"}</Text>
                {!item.readAt ? <View style={styles.notificationUnreadDot} /> : null}
              </View>
              {item.body ? <Text style={styles.notificationBody}>{item.body}</Text> : null}
              <View style={styles.notificationFooterRow}>
                <Text style={styles.notificationMeta}>{formatReceivedAt(item.receivedAt)}</Text>
                <View style={styles.notificationActions}>
                  {!item.readAt ? (
                    <Pressable onPress={(e) => { e.stopPropagation(); onMarkRead(item.id); }} style={styles.notificationActionBtn}>
                      <Text style={styles.notificationActionText}>Mark read</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={(e) => { e.stopPropagation(); onDelete(item.id); }} style={styles.notificationDeleteBtn} accessibilityLabel="Delete notification">
                    <Ionicons name="trash-outline" size={14} color={T.red} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.notificationEmpty}>No notifications yet.</Text>
      )}
      <Text style={styles.muted}>These preferences sync to your account and control automatic reminders.</Text>
    </SettingsSection>
  );
}
