import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  cardMiniActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardMiniIconBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.border}55`,
  },
  cardRowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  halfCard: {
    flex: 1,
    marginBottom: 0,
  },
  infoCard: {
    ...cardBase,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoCardHint: { color: T.textDim, fontSize: 12, fontWeight: "600", marginTop: 6 },
  infoCardLabel: { color: T.textDim, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  infoCardValue: { color: T.text, fontSize: 16, fontWeight: "900" },
  plainBudgetBlock: {
    marginBottom: 16,
  },
  plainBudgetTitle: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
});
