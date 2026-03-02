import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "transparent",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  arrowDisabled: { opacity: 0.4 },
  label: { color: T.text, fontSize: 16, fontWeight: "900" },
});
