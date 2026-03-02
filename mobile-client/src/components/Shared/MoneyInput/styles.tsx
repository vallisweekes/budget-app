import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 40,
    height: 40,
  },
  disabled: { opacity: 0.6 },
  currencyBox: {
    width: 34,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.card,
    borderRightWidth: 1,
    borderRightColor: T.border,
  },
  currencyText: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  placeholder: {
    color: T.textMuted,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: T.text,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 0,
    height: 40,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  rightBox: {
    width: 28,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 2,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  clearBtnPressed: { opacity: 0.75 },
  clearIcon: {
    color: T.textDim,
  },
});
