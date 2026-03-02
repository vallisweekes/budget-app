import { StyleSheet } from "react-native";

import { SETTINGS_MODAL_BACKDROP } from "@/lib/constants";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  disabled: { opacity: 0.6 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputDisabled: {
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    color: T.textDim,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  outlineBtnText: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  outlineBtnWide: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: T.onAccent, fontWeight: "800", fontSize: 13 },
  primaryBtnWide: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: T.accent,
    paddingVertical: 12,
    alignItems: "center",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 8,
  },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.border,
    marginBottom: 4,
  },
  sheetKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: SETTINGS_MODAL_BACKDROP,
  },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: "900", marginBottom: 6 },
});
