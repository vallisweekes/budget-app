import { Platform, StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated, textLabel } from "@/lib/ui";

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
  info: { color: T.textDim, fontSize: 14, fontWeight: "600" },
  error: { color: T.red, textAlign: "center", fontSize: 14, fontWeight: "600" },
  retryBtn: { marginTop: 8, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },

  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { color: T.textDim, fontStyle: "italic", paddingVertical: 12 },

  sectionHeader: {
    backgroundColor: "transparent",
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 2,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
  },

  card: {
    ...cardElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  pillWarn: {
    borderColor: T.orange,
  },
  pillText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  pillWarnText: {
    color: T.orange,
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.cardAlt}88`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  cardTitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  cardDesc: {
    marginTop: 6,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { ...textLabel },
  progressValue: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: T.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  progressPct: {
    marginTop: 6,
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCardWrap: {
    width: "100%",
  },
  modalCard: {
    backgroundColor: T.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: T.border,
    marginBottom: 10,
  },
  modalTitle: { color: T.text, fontSize: 16, fontWeight: "900" },
  modalSubtitle: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 4 },
  inputLabel: { color: T.textDim, fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 6 },
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
  row2: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimary: {
    backgroundColor: T.accent,
  },
  modalBtnPrimaryText: {
    color: T.onAccent,
    fontSize: 14,
    fontWeight: "900",
  },
  modalBtnGhost: {
    backgroundColor: T.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.accentBorder,
  },
  modalBtnGhostText: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: { opacity: 0.55 },
});