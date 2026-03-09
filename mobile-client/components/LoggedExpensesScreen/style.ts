import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const loggedExpensesStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 28 },
  purpleHero: {
    backgroundColor: "#2a0a9e",
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  purpleHeroLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  purpleHeroAmount: {
    color: "#ffffff",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  purpleHeroMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionHeadingWrap: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeading: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    ...cardElevated,
    marginHorizontal: 14,
    marginBottom: 8,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  rowName: {
    color: T.text,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  rowMeta: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    paddingLeft: 46,
  },
  rowAmount: {
    color: T.text,
    fontSize: 15,
    fontWeight: "900",
  },
  track: {
    height: 6,
    backgroundColor: T.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  fill: { height: "100%", borderRadius: 3 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  empty: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: T.red,
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "800",
  },
});
