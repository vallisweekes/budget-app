import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/theme";

interface Props {
  onSettings: () => void;
  onIncome: () => void;
  onAnalytics: () => void;
  onNotifications: () => void;
  leftContent?: React.ReactNode;
  leftVariant?: "avatar" | "back";
  onBack?: () => void;
  centerLabel?: string;
  centerContent?: React.ReactNode;
  showIncomeAction?: boolean;
  rightContent?: React.ReactNode;
  compactActionsMenu?: boolean;
  onLogout?: () => void;
  incomePendingCount?: number;
  onAddIncome?: () => void;
}

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
  onLogout,
  incomePendingCount = 0,
  onAddIncome,
}: Props) {
  const insets = useSafeAreaInsets();
  const { username } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const getCenterWrapStyle = () => {
    if (rightContent) {
      return null;
    }

    if (compactActionsMenu) {
      return onLogout ? s.centerWrapWithTwoActions : s.centerWrapWithOneAction;
    }

    return showIncomeAction ? s.centerWrapWithThreeActions : s.centerWrapWithTwoActions;
  };

  const centerWrapStyle = [s.centerWrap, getCenterWrapStyle()];
  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <BlurView intensity={30} tint="dark" style={[s.container, { paddingTop: insets.top }]}> 
			<View style={s.glassTint} />
			<View style={s.inner}>
        {leftContent ? (
          leftContent
        ) : leftVariant === "back" ? (
          <Pressable onPress={onBack} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </Pressable>
        ) : (
          <Pressable onPress={onSettings} style={s.avatarBtn} hitSlop={10}>
            <View style={s.avatar}>
              <Text style={s.avatarInitial}>{initial}</Text>
            </View>
          </Pressable>
        )}

        {centerContent ? (
          <View style={centerWrapStyle}>
            {centerContent}
          </View>
        ) : centerLabel ? (
          <View pointerEvents="none" style={centerWrapStyle}>
            <Text style={s.centerLabel} numberOfLines={2}>{centerLabel}</Text>
          </View>
        ) : null}

        {rightContent ? (
          <View style={s.rightActions}>{rightContent}</View>
        ) : compactActionsMenu ? (
          <View style={s.rightActions}>
            {onAddIncome ? (
              <Pressable
                onPress={onAddIncome}
                style={s.addIncomeBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Add income"
              >
                <Ionicons name="add" size={18} color={T.onAccent} />
              </Pressable>
            ) : null}
            {onLogout ? (
              <Pressable
                onPress={onLogout}
                style={s.iconBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Log out"
              >
                <Ionicons name="log-out-outline" size={18} color={T.red} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={s.menuTriggerBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Open quick actions menu"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={T.accent} />
            </Pressable>
          </View>
        ) : (
          <View style={s.rightActions}>
            {showIncomeAction ? (
              <Pressable onPress={onIncome} style={s.iconBtn} hitSlop={10}>
                <Ionicons name="wallet-outline" size={18} color={T.accent} />
                {incomePendingCount > 0 ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{incomePendingCount > 9 ? "9+" : String(incomePendingCount)}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            <Pressable onPress={onAnalytics} style={s.iconBtn} hitSlop={10}>
              <Ionicons name="stats-chart-outline" size={18} color={T.accent} />
            </Pressable>
            <Pressable onPress={onNotifications} style={s.iconBtn} hitSlop={10}>
              <Ionicons name="notifications-outline" size={18} color={T.accent} />
            </Pressable>
          </View>
        )}
			</View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={s.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[s.menuCard, { top: insets.top + 52 }]}> 
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                onIncome();
              }}
              style={s.menuItem}
              accessibilityRole="button"
              accessibilityLabel="Go to Income"
            >
              <Ionicons name="wallet-outline" size={16} color={T.text} />
              <Text style={s.menuItemText}>Income</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                onAnalytics();
              }}
              style={s.menuItem}
              accessibilityRole="button"
              accessibilityLabel="Go to Analytics"
            >
              <Ionicons name="stats-chart-outline" size={16} color={T.text} />
              <Text style={s.menuItemText}>Analytics</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                onNotifications();
              }}
              style={[s.menuItem, s.menuItemLast]}
              accessibilityRole="button"
              accessibilityLabel="Go to Notifications"
            >
              <Ionicons name="notifications-outline" size={16} color={T.text} />
              <Text style={s.menuItemText}>Notifications</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
		</BlurView>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: `${T.card}66`,
    borderBottomWidth: 1,
    borderBottomColor: `${T.accent}29`,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${T.accent}12`,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    position: "relative",
  },
  centerWrap: {
    position: "absolute",
    left: 62,
    right: 70,
    alignItems: "center",
  },
  centerWrapWithThreeActions: {
    right: 138,
  },
  centerWrapWithTwoActions: {
    right: 96,
  },
  centerWrapWithOneAction: {
    right: 70,
  },
  centerLabel: {
    color: T.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },

  avatarBtn: { position: "relative" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: T.border,
  },
  avatarInitial: { color: T.onAccent, fontSize: 14, fontWeight: "700" },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${T.cardAlt}66`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  addIncomeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.accent,
    position: "relative",
  },
  menuTriggerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${T.cardAlt}4D`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${T.border}B3`,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.red,
    borderWidth: 1,
    borderColor: T.card,
  },
  badgeText: {
    color: T.onAccent,
    fontSize: 9,
    fontWeight: "900",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  menuCard: {
    position: "absolute",
    right: 18,
    width: 184,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
