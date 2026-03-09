import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    gap: 10,
  },
  rowLabel: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  rowValue: { color: T.text, fontSize: 14, fontWeight: "800", maxWidth: "58%", textAlign: "right" },
});
