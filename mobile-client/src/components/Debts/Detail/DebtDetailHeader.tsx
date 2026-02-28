import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  editing: boolean;
  onBack: () => void;
  onToggleEdit: () => void;
  onDelete: () => void;
  hideActions?: boolean;
};

export default function DebtDetailHeader({ title, editing, onBack, onToggleEdit, onDelete, hideActions }: Props) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Ionicons name="chevron-back" size={24} color="#ffffff" />
      </Pressable>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      {!hideActions ? (
        <View style={s.headerActions}>
          <Pressable onPress={onToggleEdit} style={s.iconBtn}>
            <Ionicons name={editing ? "close" : "pencil"} size={18} color="#ffffff" />
          </Pressable>
          <Pressable onPress={onDelete} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={18} color="#ff8fa3" />
          </Pressable>
        </View>
      ) : (
        <View style={s.headerActionsPlaceholder} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: "#2a0a9e",
  },
  headerTitle: { flex: 1, color: "#ffffff", fontSize: 17, fontWeight: "900", marginLeft: 4 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerActionsPlaceholder: { width: 74 },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
});
