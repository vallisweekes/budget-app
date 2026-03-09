import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  wrap: {
    ...cardBase,
    padding: 14,
    marginHorizontal: 14,
    marginVertical: 8,
    gap: 10,
    borderColor: T.accentFaint,
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
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  btnText: { color: T.onAccent, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.45 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
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
