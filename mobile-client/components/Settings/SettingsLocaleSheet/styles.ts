import { Dimensions, StyleSheet } from "react-native";

import { SETTINGS_MODAL_BACKDROP } from "@/lib/constants";
import { T } from "@/lib/theme";

const WINDOW_HEIGHT = Dimensions.get("window").height;

export const styles = StyleSheet.create({
  disabled: { opacity: 0.6 },
  label: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  sectionWrap: {
    gap: 10,
  },
  optionChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  optionChipActive: {
    borderColor: `${T.accent}66`,
    backgroundColor: `${T.accent}16`,
  },
  optionChipText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
  },
  optionChipTextActive: {
    color: T.accent,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
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
  previewAmount: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${T.accent}24`,
    backgroundColor: `${T.cardAlt}CC`,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  previewEyebrow: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  previewText: {
    color: T.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  previewMetaList: {
    gap: 8,
  },
  previewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${T.border}AA`,
    paddingBottom: 8,
  },
  previewMetaLabel: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
  },
  previewMetaValue: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: T.border,
    minHeight: WINDOW_HEIGHT * 0.72,
    maxHeight: WINDOW_HEIGHT * 0.88,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
  },
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
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: "900", marginBottom: 6 },
});
