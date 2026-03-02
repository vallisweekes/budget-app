import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  inlineAction: { marginTop: 10, alignSelf: "flex-start" },
  inlineActionText: { color: T.accent, fontSize: 12, fontWeight: "800" },
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
});
