import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  historySection: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionTitle: { color: T.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  histHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  histCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: T.border,
  },
  histCountText: { color: T.textDim, fontSize: 11, fontWeight: "800" },
  monthGroup: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingBottom: 8,
  },
  monthHeaderCopy: {
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },
  monthTitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  monthCaption: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  monthTotal: {
    color: T.green,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  payHistRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  payHistBorder: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  payHistLeft: { flex: 1, paddingRight: 12 },
  payHistTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  payHistMeta: { color: T.textDim, fontSize: 12, marginTop: 3, fontWeight: "600" },
  payHistAmt: { color: T.green, fontSize: 16, fontWeight: "900", flexShrink: 0, textAlign: "right" },
  emptyHistory: { color: T.textDim, fontSize: 14, textAlign: "center", paddingVertical: 30, fontWeight: "600" },
});
