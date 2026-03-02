import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 14, fontWeight: "800" },
  cat: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  right: { alignItems: "flex-end", gap: 5, flexShrink: 0 },
  amount: { color: T.text, fontSize: 14, fontWeight: "900" },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
