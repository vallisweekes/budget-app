import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onSettings: () => void;
}

export default function TopHeader({ onSettings }: Props) {
  const insets = useSafeAreaInsets();
  const { username } = useAuth();
  const currentMonth = new Date().toLocaleDateString("en-GB", { month: "long" });

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.inner}>
        {/* App brand */}
        <View style={s.brand}>
          <View style={s.logoMark}>
            <Ionicons name="stats-chart" size={14} color="#02eff0" />
          </View>
          <Text style={s.appName}>{currentMonth}</Text>
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
    backgroundColor: "#0f1b2d",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(79,108,247,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },

  avatarBtn: { position: "relative" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1e3058",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(79,108,247,0.4)",
  },
  avatarInitial: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cogBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#02eff0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0f1b2d",
  },
});
