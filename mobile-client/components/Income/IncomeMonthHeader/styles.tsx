import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: T.card,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { padding: 4 },
  headerSlim: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  sideSpacer: { flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
  },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "900", flex: 1, textAlign: "center" },
  modeWrap: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    padding: 4,
    position: "relative",
  },
  modeThumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: T.accent,
  },
  modeTxt: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
  },
  modeTxtActive: {
    color: T.onAccent,
  },
});
