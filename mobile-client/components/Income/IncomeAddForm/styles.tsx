import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

const SHEET_BLUE = "#080080";

export const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 14,
  },
  title: { color: T.text, fontWeight: "900", fontSize: 15 },
  row: { flexDirection: "row", gap: 10 },
  input: {
    backgroundColor: T.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  btn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: "auto",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  btnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  btnText: { color: SHEET_BLUE, fontWeight: "800", fontSize: 14 },
  btnTextDisabled: { color: "rgba(8, 0, 128, 0.45)" },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: T.text, fontSize: 13, fontWeight: "800" },
  toggleSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: T.accent + "55",
    borderColor: T.accent,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.textMuted,
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    backgroundColor: T.accent,
    alignSelf: "flex-end",
  },
});
