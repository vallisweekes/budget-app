import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";

type Props = {
  title: string;
  editing: boolean;
  onBack: () => void;
  onToggleEdit: () => void;
  onDelete: () => void;
};

export default function DebtDetailHeader({ title, editing, onBack, onToggleEdit, onDelete }: Props) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Ionicons name="chevron-back" size={24} color={T.text} />
      </Pressable>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={s.headerActions}>
        <Pressable onPress={onToggleEdit} style={s.iconBtn}>
          <Ionicons name={editing ? "close" : "pencil"} size={18} color={T.text} />
        </Pressable>
        <Pressable onPress={onDelete} style={s.iconBtn}>
          <Ionicons name="trash-outline" size={18} color={T.red} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerTitle: { flex: 1, color: T.text, fontSize: 17, fontWeight: "900", marginLeft: 4 },
  headerActions: { flexDirection: "row", gap: 4 },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
});
