import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";

import type { GlassFooterButtonProps } from "@/types";

import { styles } from "./styles";

export default function GlassFooterButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "light",
  tone,
  containerStyle,
  glassStyle,
  labelStyle,
  loadingColor,
}: GlassFooterButtonProps) {
  const resolvedTone = tone ?? (variant === "dark" ? "light" : "dark");
  const resolvedLoadingColor = loadingColor ?? (resolvedTone === "light" ? "#ffffff" : resolvedTone === "danger" ? "#ff6b6b" : "#111827");

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled, containerStyle]}
      onPress={onPress}
      disabled={disabled}
    >
      <BlurView intensity={34} tint="light" style={[styles.glass, variant === "dark" && styles.glassDark, glassStyle]}>
        <View style={[styles.tint, variant === "dark" && styles.tintDark]} pointerEvents="none" />
        <View style={[styles.innerBorder, variant === "dark" && styles.innerBorderDark]} pointerEvents="none" />
        {loading ? (
          <ActivityIndicator size="small" color={resolvedLoadingColor} />
        ) : (
          <Text
            style={[
              styles.label,
              resolvedTone === "light" && styles.labelLight,
              resolvedTone === "dark" && styles.labelDark,
              resolvedTone === "danger" && styles.labelDanger,
              labelStyle,
            ]}
          >
            {label}
          </Text>
        )}
      </BlurView>
    </Pressable>
  );
}