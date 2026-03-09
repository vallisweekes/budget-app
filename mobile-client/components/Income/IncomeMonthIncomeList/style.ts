import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const incomeMonthIncomeListSheet = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    height: "82%",
    paddingBottom: 16,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: T.border,
  },
});