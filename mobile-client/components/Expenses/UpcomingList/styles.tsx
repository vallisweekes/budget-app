import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { CARD_RADIUS, cardBase, textLabel } from "@/lib/ui";

export const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 16 },
  title: {
    ...textLabel,
    fontWeight: "800",
    marginBottom: 8,
  },
  card: {
    ...cardBase,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  info: { flex: 1 },
  name: { color: T.text, fontSize: 13, fontWeight: "800" },
  due: { color: T.textDim, fontSize: 11, marginTop: 2, fontWeight: "600" },
  amount: { fontSize: 13, fontWeight: "700" },
});
