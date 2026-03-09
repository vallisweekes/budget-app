import { StyleSheet } from "react-native";

import { BRAND_GREEN, SETTINGS_SAVINGS_BORDER, SETTINGS_SAVINGS_HINT, SETTINGS_SAVINGS_ICON_BG, SETTINGS_SAVINGS_TITLE, SETTINGS_SAVINGS_VALUE } from "@/lib/constants";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  moneySectionCard: {
    ...cardBase,
    padding: 12,
    marginBottom: 12,
  },
  plainSavingsBlock: {
    marginBottom: 16,
  },
  savingsSectionStack: {
    marginBottom: 0,
  },
  savingsSectionTitle: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  savingsTileAddCard: {
    ...cardBase,
    backgroundColor: BRAND_GREEN,
    borderColor: SETTINGS_SAVINGS_BORDER,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  savingsTileAddText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  savingsTileCard: {
    ...cardBase,
    backgroundColor: BRAND_GREEN,
    borderColor: SETTINGS_SAVINGS_BORDER,
    borderRadius: 16,
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
    fontSize: 24,
    fontWeight: "900",
  },
  savingsTilesRow: {
    gap: 12,
    paddingRight: 2,
  },
});
