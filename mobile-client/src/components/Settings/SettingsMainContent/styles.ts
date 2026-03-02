import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  disabled: { opacity: 0.6 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center" },
  noPlanText: { color: T.textDim, fontSize: 14, textAlign: "center" },
  noPlanTitle: { color: T.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryBtnText: { color: T.onAccent, fontWeight: "800", fontSize: 13 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 86 },
  scrollNoTop: { paddingTop: 0 },
});
