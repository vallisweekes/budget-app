import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
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
  leftVariant?: "avatar" | "back";
  onBack?: () => void;
  centerLabel?: string;
  centerContent?: React.ReactNode;
  showIncomeAction?: boolean;
  rightContent?: React.ReactNode;
}

export default function TopHeader({
  onSettings,
  onIncome,
  onAnalytics,
  onNotifications,
  leftVariant = "avatar",
  onBack,
  centerLabel,
  centerContent,
  showIncomeAction = true,
  rightContent,
}: Props) {
  const insets = useSafeAreaInsets();
  const { username } = useAuth();

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <BlurView intensity={30} tint="dark" style={[s.container, { paddingTop: insets.top }]}>
			<View style={s.glassTint} />
			<View style={s.inner}>
        {leftVariant === "back" ? (
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
          <View style={s.centerWrap}>
            {centerContent}
          </View>
        ) : centerLabel ? (
          <View pointerEvents="none" style={s.centerWrap}>
            <Text style={s.centerLabel} numberOfLines={1}>{centerLabel}</Text>
          </View>
        ) : null}

        {rightContent ? (
          <View style={s.rightActions}>{rightContent}</View>
        ) : (
          <View style={s.rightActions}>
            {showIncomeAction ? (
              <Pressable onPress={onIncome} style={s.iconBtn} hitSlop={10}>
                <Ionicons name="wallet-outline" size={18} color={T.accent} />
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
    left: 70,
    right: 70,
    alignItems: "center",
  },
  centerLabel: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
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
  avatarInitial: { color: T.onAccent, fontSize: 14, fontWeight: "900" },
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
  },
});
