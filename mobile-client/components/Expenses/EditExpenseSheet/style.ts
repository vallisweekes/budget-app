import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const es = StyleSheet.create({
  footerActionRow: {
    flexDirection: "row",
    gap: 14,
  },
  footerPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  footerPillCancel: {
    backgroundColor: T.card,
    borderColor: T.border,
  },
  footerPillSave: {
    backgroundColor: T.accent,
    borderColor: T.accentBorder,
  },
  footerPillCancelText: {
    color: T.textDim,
    fontSize: 15,
    fontWeight: "800",
  },
  footerPillSaveText: {
    color: T.onAccent,
    fontSize: 15,
    fontWeight: "900",
  },
  sourceWrap: {
    marginTop: 2,
    gap: 6,
  },
  sourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sourceChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  sourceChipActive: {
    borderColor: T.accent,
    backgroundColor: "rgba(79,112,255,0.20)",
  },
  sourceChipTxt: {
    color: T.textMuted,
    fontWeight: "700",
  },
  sourceChipTxtActive: {
    color: "#ffffff",
  },
  cardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    maxWidth: "100%",
  },
  cardChipActive: {
    borderColor: T.accent,
    backgroundColor: "rgba(79,112,255,0.20)",
  },
  cardChipTxt: {
    color: T.text,
    fontWeight: "700",
  },
  cardChipTxtActive: {
    color: "#ffffff",
  },
  helpTxt: {
    marginTop: 6,
    color: T.textMuted,
    fontSize: 12,
  },
});