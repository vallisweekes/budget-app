import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderHandlers } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { fmt } from "@/lib/formatting";
import { styles } from "@/screens/dashboard/styles";

type CategorySheetProps = {
  visible: boolean;
  categoryName: string;
  expenses: Array<{ id: string; name: string; amount: number; paid?: boolean; paidAmount?: number | null }>;
  currency: string;
  dragY: Animated.Value;
  panHandlers: GestureResponderHandlers;
  onClose: () => void;
};

export default function DashboardCategorySheet({
  visible,
  categoryName,
  expenses,
  currency,
  dragY,
  panHandlers,
  onClose,
}: CategorySheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <View style={styles.sheetHeader} {...panHandlers}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {categoryName}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={22} color={T.text} />
            </Pressable>
          </View>

          <FlatList
            data={expenses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.sheetList}
            ListEmptyComponent={() => <Text style={styles.sheetEmpty}>No expenses in this category.</Text>}
            renderItem={({ item }) => (
              <View style={styles.sheetRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.sheetRowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.sheetRowSub}>
                    {item.paid ? "paid" : (item.paidAmount ?? 0) > 0 ? "partial" : "unpaid"}
                  </Text>
                </View>
                <Text style={styles.sheetRowAmt} numberOfLines={1}>
                  {fmt(item.amount, currency)}
                </Text>
              </View>
            )}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}