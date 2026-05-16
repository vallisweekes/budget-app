import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

const SHEET_BLUE = "#080080";

export const incomeMonthIncomeListSheet = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  sheet: {
    backgroundColor: SHEET_BLUE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    minHeight: "54%",
    maxHeight: "92%",
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: T.border,
  },
});