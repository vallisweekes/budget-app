import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DebtDetailHeaderProps } from "@/types";
import { styles } from "./styles";

export default function DebtDetailHeader({ title, editing, onBack, onToggleEdit, onDelete, hideActions }: DebtDetailHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color="#ffffff" />
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
  );
}
