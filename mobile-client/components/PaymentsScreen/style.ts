import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: T.onAccent, fontWeight: "700" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: { transform: [{ scale: 0.98 }] },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: T.text,
  },

  searchWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.text,
    fontWeight: "600",
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  sectionTitle: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "800",
    color: T.textDim,
  },

  row: {
    ...cardBase,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowPressed: { opacity: 0.92 },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  rowAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowAvatarLogo: { width: "100%", height: "100%" },
  rowAvatarTxt: { color: T.text, fontSize: 11, fontWeight: "900" },
  rowName: { flex: 1, color: T.text, fontSize: 14, fontWeight: "700" },
  rowAmt: { color: T.text, fontSize: 14, fontWeight: "800" },
  sep: { height: 10 },

  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { color: T.textDim, fontWeight: "700" },
});
