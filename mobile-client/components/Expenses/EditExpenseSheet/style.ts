import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const es = StyleSheet.create({
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