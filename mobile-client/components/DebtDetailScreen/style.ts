import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { paddingHorizontal: 14, paddingTop: 0, gap: 14 },
  sectionCard: {
    ...cardBase,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900", marginTop: 6 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
  bottomActionsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: T.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  bottomActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  bottomActionBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomActionTxt: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});