import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  stack: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  card: {
    ...cardBase,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardOrange: {
    borderColor: T.border,
  },
  lbl: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  val: { fontWeight: "700", fontSize: 24 },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2, fontWeight: "600" },
});
