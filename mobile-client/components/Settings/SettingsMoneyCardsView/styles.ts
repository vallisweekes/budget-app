import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  addCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addCardBtnText: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "900",
  },
  moneySectionCard: {
    ...cardBase,
    padding: 12,
    marginBottom: 12,
  },
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  plainBudgetTitle: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  plainSavingsBlock: {
    marginBottom: 16,
  },
  plainSectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
});
