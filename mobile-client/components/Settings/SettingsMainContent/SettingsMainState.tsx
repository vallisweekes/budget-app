import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { SettingsMainStateProps } from "@/types/components/settings/SettingsMainState.types";

export default function SettingsMainState({
  mode,
  errorMessage,
  retryButtonLabel,
  noPlanTitle,
  noPlanMessage,
  createButtonLabel,
  createDisabled,
  onRetry,
  onCreatePlan,
}: SettingsMainStateProps) {
  if (mode === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (mode === "error") {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={T.textDim} />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable onPress={onRetry} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>{retryButtonLabel}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Ionicons name="wallet-outline" size={44} color={T.textDim} />
      <Text style={styles.noPlanTitle}>{noPlanTitle}</Text>
      <Text style={styles.noPlanText}>{noPlanMessage}</Text>
      <Pressable onPress={onCreatePlan} style={[styles.primaryBtn, createDisabled && styles.disabled]} disabled={createDisabled}>
        <Text style={styles.primaryBtnText}>{createButtonLabel}</Text>
      </Pressable>
    </View>
  );
}
