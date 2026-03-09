import React from "react";
import { View, Text } from "react-native";
import { T } from "@/lib/theme";
import { pickAccent, isLightHex } from "@/lib/domain/colorUtils";
import { styles } from "./styles";
import type { SectionRowProps } from "@/types";

const ACCENT_COLORS = ["#0f282f", T.accent] as const;

export function SectionRow({ label, value, sub, leadingInitial, leadingColor }: SectionRowProps) {
  const badgeBg = leadingColor ?? (leadingInitial ? pickAccent(label, ACCENT_COLORS) : undefined);
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
