import { Platform, StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated, textLabel } from "@/lib/ui";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  keyboardWrap: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  info: { color: T.textDim, fontSize: 14, fontWeight: "600" },
  error: { color: T.red, textAlign: "center", fontSize: 14, fontWeight: "600" },
  retryBtn: { marginTop: 8, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },
  heroCard: {
    ...cardElevated,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
    marginRight: 10,
  },
  heroAmount: {
    color: T.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroSubtext: {
    marginTop: 4,
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: T.border,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: 12,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  card: {
    ...cardElevated,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardPressed: {
    opacity: 0.96,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 15,
    fontWeight: "900",
  },
  inputLabel: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
  },
  inputMultiline: {
    minHeight: 92,
  },
  row2: {
    flexDirection: "row",
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  readOnlyValueCard: {
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 50,
    justifyContent: "center",
  },
  readOnlyValueText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
  },
  readOnlyValueHint: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleContent: {
    flex: 1,
  },
  toggleDescription: {
    ...textLabel,
    marginTop: 6,
    lineHeight: 18,
  },
  toggleBadge: {
    minWidth: 72,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  toggleBadgeText: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleBadgeActive: {
    backgroundColor: T.accent,
    borderColor: T.accentBorder,
  },
  toggleBadgeTextActive: {
    color: T.onAccent,
  },
  bottomActionsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: T.bg,
  },
  bottomActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  bottomActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bottomActionBtnDelete: {
    backgroundColor: T.accentDim,
    borderColor: T.accentBorder,
  },
  bottomActionBtnSave: {
    backgroundColor: T.accent,
    borderColor: T.accentBorder,
  },
  bottomActionDeleteText: {
    color: T.red,
    fontSize: 14,
    fontWeight: "900",
  },
  bottomActionSaveText: {
    color: T.onAccent,
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});