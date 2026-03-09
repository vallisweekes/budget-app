import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 16, gap: 8 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBtn: {
    backgroundColor: T.accent,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  addBtnTxt: { color: T.onAccent, fontSize: 12, fontWeight: "800" },
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  cardPressed: { opacity: 0.75 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },

  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { color: T.text, fontSize: 14, fontWeight: "800", flex: 1 },
  catTotal: { color: T.text, fontSize: 15, fontWeight: "900" },

  sub: { color: T.textDim, fontSize: 12, paddingLeft: 46, fontWeight: "600" },

  track: {
    height: 6,
    backgroundColor: T.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  fill: { height: "100%", borderRadius: 3 },
});
