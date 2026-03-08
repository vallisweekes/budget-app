import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { TopHeaderProps } from "@/types";

export default function TopHeader({
  onSettings,
  onIncome,
  onAnalytics,
  onNotifications,
  leftContent,
  leftVariant = "avatar",
  onBack,
  centerLabel,
  centerContent,
  showIncomeAction = true,
  rightContent,
  compactActionsMenu = false,
  showAnalyticsAction = true,
  showNotificationAction = true,
  onLogout,
  incomePendingCount = 0,
  onAddIncome,
  showNotificationDot = false,
}: TopHeaderProps) {
  const insets = useSafeAreaInsets();
  const { username } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const shouldShowCompactMenuTrigger = !onAddIncome && (showIncomeAction || showAnalyticsAction || showNotificationAction);

  const getCenterWrapStyle = () => {
    if (rightContent) {
      return null;
    }

    if (compactActionsMenu) {
      if (onAddIncome) return styles.centerWrapWithIncomeAction;
      return onLogout ? styles.centerWrapWithTwoActions : styles.centerWrapWithOneAction;
    }

    return showIncomeAction ? styles.centerWrapWithThreeActions : styles.centerWrapWithTwoActions;
  };

  const centerWrapStyle = [styles.centerWrap, getCenterWrapStyle()];
  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <BlurView intensity={30} tint="dark" style={[styles.container, { paddingTop: insets.top }]}> 
			<View style={styles.glassTint} />
			<View style={styles.inner}>
        {leftContent ? (
          leftContent
        ) : leftVariant === "back" ? (
          <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </Pressable>
        ) : (
          <Pressable onPress={onSettings} style={styles.avatarBtn} hitSlop={10}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </Pressable>
        )}

        {centerContent ? (
          <View style={centerWrapStyle}>
            {centerContent}
          </View>
        ) : centerLabel ? (
          <View pointerEvents="none" style={centerWrapStyle}>
            <Text style={styles.centerLabel} numberOfLines={2}>{centerLabel}</Text>
          </View>
        ) : null}

        {rightContent ? (
          <View style={styles.rightActions}>{rightContent}</View>
        ) : compactActionsMenu ? (
          <View style={styles.rightActions}>
            {onAddIncome ? (
              <Pressable
                onPress={onAddIncome}
                style={styles.addIncomeBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Add income"
              >
                <Ionicons name="add" size={18} color={T.onAccent} />
                <Text style={styles.addIncomeBtnText}>Income</Text>
              </Pressable>
            ) : null}
            {onLogout ? (
              <Pressable
                onPress={onLogout}
                style={styles.iconBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Log out"
              >
                <Ionicons name="log-out-outline" size={18} color={T.red} />
              </Pressable>
            ) : null}
            {shouldShowCompactMenuTrigger ? (
              <Pressable
                onPress={() => setMenuOpen(true)}
                style={styles.menuTriggerBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Open quick actions menu"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={T.accent} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.rightActions}>
            {showIncomeAction ? (
              <Pressable onPress={onIncome} style={styles.iconBtn} hitSlop={10}>
                <Ionicons name="wallet-outline" size={18} color={T.accent} />
                {incomePendingCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{incomePendingCount > 9 ? "9+" : String(incomePendingCount)}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            {showAnalyticsAction ? (
              <Pressable onPress={onAnalytics} style={styles.iconBtn} hitSlop={10}>
                <Ionicons name="stats-chart-outline" size={18} color={T.accent} />
              </Pressable>
            ) : null}
            {showNotificationAction ? (
              <Pressable onPress={onNotifications} style={styles.iconBtn} hitSlop={10}>
                <Ionicons name="notifications-outline" size={18} color={T.accent} />
                {showNotificationDot ? <View style={styles.notificationDot} /> : null}
              </Pressable>
            ) : null}
          </View>
        )}
			</View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menuCard, { top: insets.top + 52 }]}> 
            {showIncomeAction ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onIncome();
                }}
                style={styles.menuItem}
                accessibilityRole="button"
                accessibilityLabel="Go to Income"
              >
                <Ionicons name="wallet-outline" size={16} color={T.text} />
                <Text style={styles.menuItemText}>Income</Text>
              </Pressable>
            ) : null}
            {showAnalyticsAction ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onAnalytics();
                }}
                style={styles.menuItem}
                accessibilityRole="button"
                accessibilityLabel="Go to Analytics"
              >
                <Ionicons name="stats-chart-outline" size={16} color={T.text} />
                <Text style={styles.menuItemText}>Analytics</Text>
              </Pressable>
            ) : null}
            {showNotificationAction ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onNotifications();
                }}
                style={[styles.menuItem, styles.menuItemLast]}
                accessibilityRole="button"
                accessibilityLabel="Go to Notifications"
              >
                <Ionicons name="notifications-outline" size={16} color={T.text} />
                <Text style={styles.menuItemText}>Notifications</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
		</BlurView>
  );
}
