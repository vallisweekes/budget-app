import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ScanReceiptShortcutProps } from "@/types";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function ScanReceiptShortcut({ onPress }: ScanReceiptShortcutProps) {
  return (
    <Pressable
      style={styles.scanShortcutCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Scan receipt"
    >
      <View style={styles.scanShortcutIconWrap}>
        <Ionicons name="camera" size={18} color={T.accent} />
      </View>
      <View style={styles.scanShortcutCopy}>
        <Text style={styles.scanShortcutTitle}>Scan receipt instead</Text>
        <Text style={styles.scanShortcutSub}>Use the camera to prefill amount, merchant, and date.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={T.textDim} />
    </Pressable>
  );
}