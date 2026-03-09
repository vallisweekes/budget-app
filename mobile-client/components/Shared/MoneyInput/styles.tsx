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
  wrapLight: {
    borderColor: "rgba(255,255,255,0.40)",
    backgroundColor: "#ffffff",
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
  currencyBoxLight: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRightColor: "rgba(0,0,0,0.12)",
  },
  currencyText: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  currencyTextLight: {
    color: "#1f2937",
  },
  placeholder: {
    color: T.textMuted,
  },
  placeholderLight: {
    color: "rgba(17,24,39,0.55)",
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
  inputLight: {
    color: "#111827",
  },
  rightBox: {
    width: 28,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 2,
  },
  rightBoxLight: {
    backgroundColor: "#ffffff",
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
  clearBtnLight: {
    borderColor: "rgba(0,0,0,0.15)",
    backgroundColor: "#ffffff",
  },
  clearBtnPressed: { opacity: 0.75 },
  clearIcon: {
    color: T.textDim,
  },
  clearIconLight: {
    color: "#6b7280",
  },
});
