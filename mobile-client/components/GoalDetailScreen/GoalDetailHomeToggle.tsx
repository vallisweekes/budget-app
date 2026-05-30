import React from "react";
import { Pressable, Text, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import type { GoalDetailHomeToggleProps } from "@/types";
import { styles } from "./style";

export default function GoalDetailHomeToggle({ showOnHome, disabled, onPress }: GoalDetailHomeToggleProps) {
  const { t } = useAppTranslation();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.card, styles.toggleCard, pressed && styles.cardPressed]}
    >
      <View style={styles.toggleContent}>
        <Text style={styles.sectionTitle}>{t("goals.detail.homeTitle")}</Text>
        <Text style={styles.toggleDescription}>
          {showOnHome ? t("goals.detail.removeHome") : t("goals.detail.pinHome")}
        </Text>
      </View>
      <View style={[styles.toggleBadge, showOnHome && styles.toggleBadgeActive]}>
        <Text style={[styles.toggleBadgeText, showOnHome && styles.toggleBadgeTextActive]}>{showOnHome ? t("goals.detail.remove") : t("goals.detail.add")}</Text>
      </View>
    </Pressable>
  );
}