import { StyleSheet } from "react-native";

import { BRAND_GREEN, SETTINGS_SAVINGS_BORDER, SETTINGS_SAVINGS_HINT, SETTINGS_SAVINGS_ICON_BG, SETTINGS_SAVINGS_TITLE, SETTINGS_SAVINGS_VALUE } from "@/lib/constants";
import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  moneySectionCard: {
    ...cardElevated,
    padding: 14,
    marginBottom: 14,
    borderColor: `${T.accent}20`,
    backgroundColor: `${T.card}F7`,
  },
  plainSavingsBlock: {
    marginBottom: 16,
  },
  savingsSectionStack: {
    marginBottom: 0,
  },
  savingsSectionTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
    paddingHorizontal: 2,
    letterSpacing: 0.2,
  },
  savingsTilesRowWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  savingsTilesScroller: {
    flex: 1,
  },
  savingsFixedAddWrap: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsTileAddCircle: {
    ...cardBase,
    backgroundColor: BRAND_GREEN,
    borderColor: SETTINGS_SAVINGS_BORDER,
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  savingsTileCard: {
    ...cardBase,
    backgroundColor: BRAND_GREEN,
    borderColor: SETTINGS_SAVINGS_BORDER,
    borderRadius: 18,
    padding: 12,
    justifyContent: "space-between",
  },
  savingsTileHint: {
    color: SETTINGS_SAVINGS_HINT,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
  savingsTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SETTINGS_SAVINGS_ICON_BG,
  },
  savingsTileTitle: {
    color: SETTINGS_SAVINGS_TITLE,
    fontSize: 13,
    fontWeight: "800",
  },
  savingsTileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  savingsTileValue: {
    color: SETTINGS_SAVINGS_VALUE,
    fontSize: 22,
    fontWeight: "900",
  },
  savingsTilesRow: {
    gap: 12,
    paddingRight: 2,
  },
});
