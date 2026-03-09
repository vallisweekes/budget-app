import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { flex: 1 },
  headerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    backgroundColor: `${T.red}18`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerLogoutText: { color: T.red, fontSize: 12, fontWeight: "800" },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 10 },
  card: {
    ...cardBase,
    padding: 14,
    marginBottom: 10,
  },
  cardActive: {
    borderColor: T.accent,
    backgroundColor: T.accentFaint,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { color: T.text, fontSize: 15, fontWeight: "800" },
  cardTitleActive: { color: T.accent },
  cardTip: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  tipCard: {
    ...cardElevated,
    padding: 14,
    marginTop: 2,
  },
  tipTitle: { color: T.text, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  tipText: { color: T.textDim, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: `${T.bg}F2`,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  saveBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});