import React from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

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
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const switchTrackColor = { false: T.border, true: T.accentFaint };
  const [inboxVisible, setInboxVisible] = React.useState(false);
  const lastOpenedTokenRef = React.useRef<string | null>(null);

  const inboxOpenToken = React.useMemo(() => {
    const token = params.notificationsInboxToken;
    if (Array.isArray(token)) return token[0] ?? "";
    return typeof token === "string" ? token : "";
  }, [params.notificationsInboxToken]);

  React.useEffect(() => {
    if (!inboxOpenToken) return;
    if (lastOpenedTokenRef.current === inboxOpenToken) return;
    lastOpenedTokenRef.current = inboxOpenToken;
    setInboxVisible(true);
  }, [inboxOpenToken]);

  const unreadCount = React.useMemo(
    () => inbox.reduce((count, item) => (item.readAt ? count : count + 1), 0),
    [inbox],
  );

  return (
    <>
      <SettingsSection title="Notifications">
        <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />

        <View style={styles.preferencesCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Due reminders</Text>
            <Switch
              value={notifications.dueReminders}
              onValueChange={(value) => onSaveNotifications({ ...notifications, dueReminders: value })}
              trackColor={switchTrackColor}
              thumbColor={T.onAccent}
              ios_backgroundColor={T.border}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Payment alerts</Text>
            <Switch
              value={notifications.paymentAlerts}
              onValueChange={(value) => onSaveNotifications({ ...notifications, paymentAlerts: value })}
              trackColor={switchTrackColor}
              thumbColor={T.onAccent}
              ios_backgroundColor={T.border}
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Daily tips</Text>
            <Switch
              value={notifications.dailyTips}
              onValueChange={(value) => onSaveNotifications({ ...notifications, dailyTips: value })}
              trackColor={switchTrackColor}
              thumbColor={T.onAccent}
              ios_backgroundColor={T.border}
            />
          </View>
        </View>
        <Text style={styles.notificationHeading}>Recent notifications</Text>
        <Text style={styles.mailboxHint}>
          Tap the mailbox icon in the top-right to view {inbox.length} recent notification{inbox.length === 1 ? "" : "s"}
          {unreadCount > 0 ? ` (${unreadCount} unread)` : ""}.
        </Text>
        <Text style={styles.footerHint}>These preferences sync to your account and control automatic reminders.</Text>
      </SettingsSection>

      <Modal transparent visible={inboxVisible} animationType="fade" onRequestClose={() => setInboxVisible(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setInboxVisible(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Recent notifications</Text>
              <Pressable style={styles.sheetCloseBtn} onPress={() => setInboxVisible(false)} accessibilityLabel="Close inbox">
                <Ionicons name="close" size={16} color={T.textDim} />
              </Pressable>
            </View>

            {inbox.length ? (
              <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent} showsVerticalScrollIndicator={false}>
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
              </ScrollView>
            ) : (
              <Text style={styles.notificationEmpty}>No notifications yet.</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
