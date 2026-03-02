import React from "react";
import { View, Text } from "react-native";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { SectionRowProps } from "@/types";

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

export function SectionRow({ label, value, sub, leadingInitial, leadingColor }: SectionRowProps) {
  const badgeBg = leadingColor ?? (leadingInitial ? pickAccent(label) : undefined);
  const badgeFg = badgeBg && !isLightHex(badgeBg) ? "#ffffff" : "#0f282f";

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {leadingInitial ? (
          <View style={[styles.badge, badgeBg ? { backgroundColor: badgeBg, borderColor: "rgba(15,40,47,0.08)" } : null]}>
            <Text style={[styles.badgeText, { color: badgeFg }]}>{leadingInitial}</Text>
          </View>
        ) : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.right}>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}
