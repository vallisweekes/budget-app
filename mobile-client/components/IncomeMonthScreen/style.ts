import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  sourcesButtonRow: {
    marginHorizontal: 14,
    marginTop: 18,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  sourcesAddBtn: {
    minWidth: 116,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: T.accent,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sourcesAddBtnText: { color: T.onAccent, fontSize: 15, fontWeight: "800" },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyText: { color: T.text, fontSize: 15, fontWeight: "800" },
  emptySub: { color: T.textDim, fontSize: 13, fontWeight: "600" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
