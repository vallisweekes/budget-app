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
  wrapSheet: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(12,16,36,0.94)",
    borderRadius: 18,
    minHeight: 56,
    height: 56,
  },
  wrapUnderline: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.72)",
    backgroundColor: "transparent",
    borderRadius: 0,
    minHeight: 52,
    height: 52,
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
  currencyBoxSheet: {
    width: 48,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  currencyBoxUnderline: {
    width: 28,
    backgroundColor: "transparent",
    borderRightWidth: 0,
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
  currencyTextSheet: {
    color: "rgba(244,246,255,0.92)",
    fontSize: 16,
    fontWeight: "900",
  },
  currencyTextUnderline: {
    color: "rgba(244,246,255,0.78)",
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    color: T.textMuted,
  },
  placeholderLight: {
    color: "rgba(17,24,39,0.55)",
  },
  placeholderSheet: {
    color: "rgba(244,246,255,0.36)",
  },
  placeholderUnderline: {
    color: "rgba(244,246,255,0.34)",
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
  inputSheet: {
    color: "#f4f6ff",
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 14,
    height: 56,
  },
  inputUnderline: {
    color: "#f4f6ff",
    fontSize: 18,
    fontWeight: "500",
    paddingHorizontal: 0,
    height: 52,
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
  rightBoxSheet: {
    width: 38,
    backgroundColor: "rgba(12,16,36,0.94)",
    paddingRight: 8,
  },
  rightBoxUnderline: {
    width: 26,
    backgroundColor: "transparent",
    paddingRight: 0,
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
  clearBtnSheet: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  clearBtnUnderline: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "transparent",
  },
  clearBtnPressed: { opacity: 0.75 },
  clearIcon: {
    color: T.textDim,
  },
  clearIconLight: {
    color: "#6b7280",
  },
  clearIconSheet: {
    color: "rgba(244,246,255,0.60)",
  },
  clearIconUnderline: {
    color: "rgba(244,246,255,0.52)",
  },
});
