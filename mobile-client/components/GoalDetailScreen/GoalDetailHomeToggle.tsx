import React from "react";
import { Pressable, Text, View } from "react-native";

import { styles } from "./style";

type GoalDetailHomeToggleProps = {
  showOnHome: boolean;
  disabled: boolean;
  onPress: () => void;
};

export default function GoalDetailHomeToggle({ showOnHome, disabled, onPress }: GoalDetailHomeToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.card, styles.toggleCard, pressed && styles.cardPressed]}
    >
      <View style={styles.toggleContent}>
        <Text style={styles.sectionTitle}>Show on Home</Text>
        <Text style={styles.toggleDescription}>
          {showOnHome ? "Remove this goal from the Home dashboard summary." : "Pin this goal to the Home dashboard summary."}
        </Text>
      </View>
      <View style={[styles.toggleBadge, showOnHome && styles.toggleBadgeActive]}>
        <Text style={[styles.toggleBadgeText, showOnHome && styles.toggleBadgeTextActive]}>{showOnHome ? "Remove" : "Add"}</Text>
      </View>
    </Pressable>
  );
}