import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

const CARD = 128;

export const styles = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 6 },
  card: {
    width: CARD,
    height: CARD,
    ...cardElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    padding: 14,
    justifyContent: "space-between",
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  name: { color: "rgba(244,246,255,0.95)", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  amount: { color: "rgba(244,246,255,0.72)", fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(124,92,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.28)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillTxt: { color: "rgba(244,246,255,0.9)", fontSize: 12, fontWeight: "900" },

  indicatorWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 10,
    gap: 6,
  },
  indicatorDot: {
    height: 6,
    width: 6,
    borderRadius: 999,
    backgroundColor: "rgba(244,246,255,0.24)",
  },
  indicatorDotActive: {
    width: 20,
    height: 6,
    backgroundColor: "#8c72ff",
  },
});
