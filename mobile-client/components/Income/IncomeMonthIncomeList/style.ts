import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

const SHEET_SURFACE = "#0c1022";

export const incomeMonthIncomeListSheet = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3, 6, 14, 0.62)",
  },
  sheet: {
    position: "relative",
    backgroundColor: SHEET_SURFACE,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "88%",
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.42,
    shadowRadius: 26,
    elevation: 30,
  },
  innerStroke: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    bottom: 0,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  handle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    alignSelf: "center",
    marginTop: 2,
    marginBottom: 18,
    backgroundColor: "rgba(244, 246, 255, 0.18)",
  },
});