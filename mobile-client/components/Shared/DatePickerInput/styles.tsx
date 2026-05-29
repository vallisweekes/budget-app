import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    color: T.text,
    fontSize: 18,
    fontWeight: "500",
    flex: 1,
    paddingRight: 8,
  },
  placeholder: {
    color: T.textMuted,
  },
});
