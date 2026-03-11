import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { styles } from "./styles";

import { T } from "@/lib/theme";
import type { IncomeMonthHeaderProps } from "@/types";

export default function IncomeMonthHeader({
  monthLabel,
  isLocked,
  viewMode,
  showAddForm,
  hideNavTitleRow = false,
  onHeightChange,
  onBack,
  onToggleAdd,
  onSetMode,
}: IncomeMonthHeaderProps) {
  const slideAnim = useRef(new Animated.Value(0)).current; // 0=income, 1=sacrifice
  const [pillWidth, setPillWidth] = useState(0);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: viewMode === "sacrifice" ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [viewMode, slideAnim]);
  return (
    <BlurView
      intensity={28}
      tint="dark"
      style={styles.glassShell}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.glassTint} pointerEvents="none" />
      {!hideNavTitleRow ? (
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{monthLabel}</Text>
          {viewMode === "income" ? (
            <Pressable onPress={onToggleAdd} style={styles.addBtn} hitSlop={8} disabled={isLocked}>
              <Ionicons
                name={isLocked ? "lock-closed-outline" : showAddForm ? "close" : "add"}
                size={18}
                color={isLocked ? T.textMuted : T.text}
              />
            </Pressable>
          ) : <View style={styles.addBtn} />}
        </View>
      ) : (
        <View style={styles.headerSlim}>
          <View style={styles.sideSpacer} />
        </View>
      )}

      <View
        style={styles.modeWrap}
        onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
      >
        {pillWidth > 0 && (
          <Animated.View
            style={[
              styles.modeThumb,
              {
                width: (pillWidth - 8) / 2,
                transform: [{
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (pillWidth - 8) / 2],
                  }),
                }],
              },
            ]}
          />
        )}
        <Pressable style={styles.modePill} onPress={() => onSetMode("income")}>
          <Text style={[styles.modeTxt, viewMode === "income" && styles.modeTxtActive]}>Income</Text>
        </Pressable>
        <Pressable style={styles.modePill} onPress={() => onSetMode("sacrifice")}>
          <Text style={[styles.modeTxt, viewMode === "sacrifice" && styles.modeTxtActive]}>Income sacrifice</Text>
        </Pressable>
      </View>
    </BlurView>
  );
}
