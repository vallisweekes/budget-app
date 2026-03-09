import React from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SelectionSheetProps } from "@/types";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function SelectionSheet({ dragY, emptyText, onClose, onSelect, panHandlers, selectedId, title, visible, items }: SelectionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView contentContainerStyle={styles.catList}>
            {items.map((item) => (
              <Pressable key={item.id} style={[styles.catRow, selectedId === item.id && styles.catRowSelected]} onPress={() => onSelect(item.id)}>
                {typeof item.color !== "undefined" ? <View style={[styles.catDot, { backgroundColor: item.color ?? T.accentDim }]} /> : null}
                <Text style={styles.catName}>{item.label}</Text>
                {selectedId === item.id ? <Ionicons name="checkmark" size={16} color={T.accent} style={styles.catCheck} /> : null}
              </Pressable>
            ))}
            {items.length === 0 && emptyText ? <Text style={styles.emptySheetState}>{emptyText}</Text> : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}