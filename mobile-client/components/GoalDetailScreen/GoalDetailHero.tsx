import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { GoalDetailHeroProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function GoalDetailHero({ title, currentAmount, targetAmount, currency, progress }: GoalDetailHeroProps) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Ionicons name="create-outline" size={18} color={T.accent} />
      </View>
      <Text style={styles.heroAmount}>{fmt(currentAmount, currency ?? undefined)}</Text>
      <Text style={styles.heroSubtext}>Target {fmt(targetAmount, currency ?? undefined)}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}