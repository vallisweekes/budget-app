import { Dimensions, StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const { height: ADD_EXPENSE_SHEET_SCREEN_H } = Dimensions.get("window");

export const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: ADD_EXPENSE_SHEET_SCREEN_H * 0.92,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: T.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  title: { color: T.text, fontSize: 18, fontWeight: "900" },
  sub: { color: T.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    backgroundColor: T.cardAlt,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: T.border,
  },

  formScroll: { padding: 20, gap: 18 },

  halfRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  halfCol: {
    flex: 1,
    minWidth: 0,
  },

  fieldGroup: { gap: 8 },
  label: { color: T.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  optional: { color: T.textMuted, fontWeight: "600" },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...cardBase,
    padding: 16,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: T.text, fontSize: 14, fontWeight: "800" },
  toggleSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: `${T.accent}55`,
    borderColor: T.accent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.textMuted,
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    backgroundColor: T.accent,
    alignSelf: "flex-end",
  },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${T.red}18`,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: `${T.red}44`,
  },
  errorTxt: { color: T.red, fontSize: 13, fontWeight: "700", flex: 1 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.45 },
  submitTxt: { color: T.onAccent, fontSize: 16, fontWeight: "900" },
});

export const pr = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillSelected: {
    backgroundColor: T.accentDim,
    borderColor: T.accent,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillTxt: { color: T.textDim, fontSize: 13, fontWeight: "700" },
  pillTxtSelected: { color: T.text, fontWeight: "900" },
});
