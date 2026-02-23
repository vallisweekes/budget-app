import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { T } from "@/lib/theme";

interface Props {
  label: string;
  value: string;
  sub?: string;
  leadingInitial?: string;
  leadingColor?: string;
}

const ACCENT_COLORS = ["#0f282f", T.accent] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickAccent(seed: string): string {
  const idx = hashString(seed) % ACCENT_COLORS.length;
  return ACCENT_COLORS[idx]!;
}

function isLightHex(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  // Relative luminance (sRGB)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.72;
}

export function SectionRow({ label, value, sub, leadingInitial, leadingColor }: Props) {
  const badgeBg = leadingColor ?? (leadingInitial ? pickAccent(label) : undefined);
  const badgeFg = badgeBg && !isLightHex(badgeBg) ? "#ffffff" : "#0f282f";

  return (
    <View style={s.row}>
      <View style={s.left}>
        {leadingInitial ? (
          <View style={[s.badge, badgeBg ? { backgroundColor: badgeBg, borderColor: "rgba(15,40,47,0.08)" } : null]}>
            <Text style={[s.badgeText, { color: badgeFg }]}>{leadingInitial}</Text>
          </View>
        ) : null}
        <Text style={s.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={s.right}>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
        <Text style={s.value}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,40,47,0.10)",
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12, gap: 10 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(15,40,47,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#0f282f", fontSize: 14, fontWeight: "900" },
  label: { color: "rgba(15,40,47,0.70)", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  value: { color: "#0f282f", fontSize: 14, fontWeight: "800" },
  sub: { color: "rgba(15,40,47,0.48)", fontSize: 12, fontWeight: "700" },
});
