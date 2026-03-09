import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  outlineBtnText: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  planName: { color: T.text, fontSize: 14, fontWeight: "800" },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  planSub: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
  primaryGhostBtn: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryGhostText: { color: T.text, fontSize: 16, fontWeight: "800" },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.red}22`,
  },
});
