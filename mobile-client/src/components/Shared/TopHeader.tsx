import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { StatusBar } from "expo-status-bar";

interface Props {
  onSettings: () => void;
}

export default function TopHeader({ onSettings }: Props) {
  const insets = useSafeAreaInsets();
  const { username } = useAuth();

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={s.inner}>
        {/* App brand */}
        <View style={s.brand}>
          <View style={s.logoMark}>
            <Ionicons name="stats-chart" size={14} color="#0f282f" />
          </View>
        </View>

        {/* Settings button — user avatar + cog badge */}
        <Pressable onPress={onSettings} style={s.avatarBtn} hitSlop={10}>
          <View style={s.avatar}>
            <Text style={s.avatarInitial}>{initial}</Text>
          </View>
          <View style={s.cogBadge}>
            <Ionicons name="settings-sharp" size={10} color="#fff" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,40,47,0.10)",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(15,40,47,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { color: "#0f282f", fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },

  avatarBtn: { position: "relative" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#02eff0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(15,40,47,0.15)",
  },
  avatarInitial: { color: "#061b1c", fontSize: 14, fontWeight: "900" },
  cogBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0f282f",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
});
