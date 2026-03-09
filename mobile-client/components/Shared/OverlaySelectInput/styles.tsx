import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  anchor: {
    position: "relative",
    zIndex: 20,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "600",
  },
  menu: {
    position: "absolute",
    top: 46,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: T.cardAlt,
    zIndex: 30,
    elevation: 8,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemActive: {
    backgroundColor: `${T.accent}20`,
  },
  itemText: {
    color: T.text,
    fontSize: 13,
    fontWeight: "700",
  },
});
