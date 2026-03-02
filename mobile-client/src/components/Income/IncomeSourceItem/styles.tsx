import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  card: {
    ...cardBase,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginVertical: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  pressed: { opacity: 0.75 },
  left: { flex: 1, minWidth: 0 },
  name: { color: T.text, fontSize: 15, fontWeight: "800" },
  hint: { color: T.textDim, fontSize: 11, marginTop: 2, fontWeight: "600" },
  right: {
    width: 20,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  editWrap: {
    ...cardBase,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 14,
    gap: 10,
    borderColor: T.accentFaint,
  },
  editInputs: { flexDirection: "row", gap: 10 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
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
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.cardAlt,
  },
  cancelText: { color: T.textDim, fontWeight: "700", fontSize: 13 },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: T.accent },
  saveText: { color: T.onAccent, fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
});
