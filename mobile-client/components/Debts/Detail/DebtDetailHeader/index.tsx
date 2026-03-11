import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DebtDetailHeaderProps } from "@/types";
import { styles } from "./styles";

export default function DebtDetailHeader({ title, editing, onBack, onToggleEdit, onDelete, hideActions }: DebtDetailHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView intensity={30} tint="dark" style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.glassTint} pointerEvents="none" />
      <View style={styles.inner}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {!hideActions ? (
          <View style={styles.headerActions}>
            <Pressable onPress={onToggleEdit} style={styles.iconBtn}>
              <Ionicons name={editing ? "close" : "pencil"} size={18} color="#ffffff" />
            </Pressable>
            <Pressable onPress={onDelete} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={18} color="#ff8fa3" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerActionsPlaceholder} />
        )}
      </View>
    </BlurView>
  );
}
