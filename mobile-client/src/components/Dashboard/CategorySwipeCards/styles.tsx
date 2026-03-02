import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

const CARD = 122;

export const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 6 },
  card: {
    width: CARD,
    height: CARD,
    ...cardElevated,
    padding: 14,
    justifyContent: "space-between",
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  name: { color: T.text, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  amount: { color: T.textDim, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: T.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillTxt: { color: T.text, fontSize: 12, fontWeight: "900" },

  indicatorWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 10,
    gap: 6,
  },
  indicatorDot: {
    height: 4,
    width: 6,
    borderRadius: 999,
    backgroundColor: T.textMuted,
  },
  indicatorDotActive: {
    width: 18,
    backgroundColor: T.accent,
  },
});
