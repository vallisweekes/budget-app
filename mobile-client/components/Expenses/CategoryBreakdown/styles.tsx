import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 18, gap: 10 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBtn: {
    backgroundColor: T.accent,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: T.accent,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  addBtnTxt: { color: T.onAccent, fontSize: 15, fontWeight: "800" },
  sectionLabel: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  card: {
    ...cardElevated,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: "#141826",
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 24,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cardPressed: { opacity: 0.75 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },

  iconWrap: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { color: T.text, fontSize: 16, fontWeight: "800", flex: 1 },
  catTotal: { color: T.text, fontSize: 17, fontWeight: "900" },

  sub: { color: T.textDim, fontSize: 13, paddingLeft: 52, fontWeight: "600" },

  track: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  fill: { height: "100%", borderRadius: 999 },
});
