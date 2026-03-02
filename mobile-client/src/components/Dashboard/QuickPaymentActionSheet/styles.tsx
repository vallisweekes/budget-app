import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

const SHEET_BLUE = "#2a0a9e";

export const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: SHEET_BLUE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: T.border,
  },
  handleTouch: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 10,
    marginBottom: 2,
  },
  hero: { alignItems: "center", paddingTop: 6, paddingBottom: 6 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: T.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarTxt: { color: T.text, fontSize: 16, fontWeight: "900" },
  avatarLogo: { width: "100%", height: "100%" },
  name: { color: T.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  amount: { color: T.text, fontSize: 34, fontWeight: "900", letterSpacing: -0.7, marginTop: 6 },
  sub: { color: T.textDim, fontSize: 13, fontWeight: "700", marginTop: 8 },

  loadingRow: { paddingVertical: 10, alignItems: "center" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 10 },
  actionBtn: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  actionBtnPrimary: { backgroundColor: "#ffffff" },
  actionBtnSecondary: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  actionPrimaryTxt: { color: SHEET_BLUE, fontSize: 14, fontWeight: "900" },
  actionSecondaryTxt: { color: T.text, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 },

  paidHint: { marginTop: 16, marginBottom: 6, color: T.green, fontSize: 13, fontWeight: "900", textAlign: "center" },
});
