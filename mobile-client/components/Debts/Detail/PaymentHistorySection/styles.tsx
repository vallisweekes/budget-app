import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  histHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  histHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  histCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  histCountText: { color: T.textDim, fontSize: 10, fontWeight: "800" },
  payHistRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  payHistBorder: { borderTopWidth: 1, borderTopColor: T.border },
  payHistLeft: { flex: 1, paddingRight: 12 },
  payHistDate: { color: T.text, fontSize: 13, fontWeight: "800" },
  payHistSource: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  payHistAmt: { color: T.green, fontSize: 14, fontWeight: "800", flexShrink: 0, textAlign: "right" },
  emptyHistory: { color: T.textDim, fontSize: 13, textAlign: "center", paddingVertical: 16, fontWeight: "600" },
});
