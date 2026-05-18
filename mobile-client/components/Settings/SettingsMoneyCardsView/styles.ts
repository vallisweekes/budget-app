import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";

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
    shadowColor: T.accent,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addCardBtnText: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "900",
  },
  moneySectionCard: {
    ...cardElevated,
    padding: 14,
    marginBottom: 14,
    borderColor: `${T.accent}20`,
    backgroundColor: `${T.card}F7`,
  },
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  plainBudgetTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
    paddingHorizontal: 2,
    letterSpacing: 0.2,
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
