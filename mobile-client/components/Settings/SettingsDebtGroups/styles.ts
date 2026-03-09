import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  debtCard: {
    ...cardBase,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  debtCardBody: {
    flex: 1,
    paddingRight: 4,
  },
  debtName: { color: T.text, fontSize: 14, fontWeight: "800" },
  debtSub: { color: T.textDim, fontSize: 12, marginTop: 3, fontWeight: "600" },
  debtTypeBlock: {
    marginBottom: 12,
  },
  debtTypeCount: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  debtTypeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  debtTypeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.border}55`,
  },
  debtTypeTitle: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
});
