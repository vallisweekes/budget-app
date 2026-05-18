import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  muted: {
    color: T.textMuted,
    fontSize: 13,
    marginTop: 8,
    fontWeight: "700",
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: `${T.accent}46`,
    backgroundColor: `${T.accent}1A`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  outlineBtnCurrent: {
    borderColor: `${T.accent}73`,
    backgroundColor: `${T.accent}24`,
  },
  outlineBtnText: { color: T.text, fontSize: 12, fontWeight: "900", letterSpacing: 0.2 },
  outlineBtnTextCurrent: { color: T.accent },
  planName: { color: T.text, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: `${T.accent}24`,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: `${T.cardAlt}D0`,
  },
  planRowCurrent: {
    borderColor: `${T.accent}66`,
    backgroundColor: `${T.accent}16`,
  },
  planSub: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "700" },
  primaryGhostBtn: {
    borderWidth: 1,
    borderColor: `${T.accent}40`,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: `${T.cardAlt}D8`,
  },
  primaryGhostText: { color: T.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${T.red}8A`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.red}26`,
  },
});
