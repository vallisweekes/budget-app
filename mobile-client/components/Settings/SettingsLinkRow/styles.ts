import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  label: {
    flex: 1,
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
  },
  labelDanger: {
    color: T.red,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "52%",
  },
  value: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
});