import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  wrap: {
    paddingTop: 2,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  backLabel: {
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
});