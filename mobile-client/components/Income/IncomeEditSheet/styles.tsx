import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.accentBorder,
  },
  safe: { flex: 1 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: T.border,
    marginTop: 10,
    marginBottom: 6,
  },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },

  nameInput: {
    ...cardBase,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: T.text,
    fontSize: 18,
    fontWeight: "800",
    backgroundColor: T.card,
  },
  nameLabel: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },

  /* Amount — no panel, sits on raw background */
  amountArea: {
    marginTop: 40,
    alignItems: "center",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  currencySign: {
    color: T.accent,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
    marginRight: 2,
    lineHeight: 44,
  },
  amountInput: {
    color: T.text,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    minWidth: 80,
    textAlign: "center",
    padding: 0,
  },
  amountStatic: {
    color: T.text,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    textAlign: "center",
  },

  /* Shared action row */
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  topActionRow: {
    marginTop: 40,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 13,
    borderWidth: 1,
  },
  pillEdit:   { backgroundColor: T.card,             borderColor: T.border },
  pillDelete: { backgroundColor: `${T.red}14`,        borderColor: `${T.red}55` },
  pillCancel: { backgroundColor: T.card,             borderColor: T.border },
  pillSave:   { backgroundColor: T.accent,           borderColor: T.accentBorder },

  pillEditText:   { color: T.textDim,  fontSize: 14, fontWeight: "700" },
  pillDeleteText: { color: T.red,      fontSize: 14, fontWeight: "700" },
  cancelText:     { color: T.textDim,  fontSize: 15, fontWeight: "800" },
  saveText:       { color: T.onAccent, fontSize: 15, fontWeight: "900" },

  /* Chart */
  chartWrap:       { marginTop: 22 },
  chartFooter:     { flexDirection: "row", alignItems: "baseline", marginTop: 2, paddingLeft: 28 },
  chartPct:        { color: T.accent,   fontSize: 13, fontWeight: "800" },
  chartSub:        { color: T.textDim,  fontSize: 11, fontWeight: "600" },

  /* Delete confirmation card */
  confirmCard: {
    marginTop: 20,
    backgroundColor: `${T.red}10`,
    borderWidth: 1,
    borderColor: `${T.red}40`,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  confirmTitle: { color: T.text,    fontSize: 15, fontWeight: "800", marginBottom: 4 },
  confirmSub:   { color: T.textDim, fontSize: 13, fontWeight: "600" },

  disabled:      { opacity: 0.55 },
  disabledInput: { opacity: 0.7 },
});
