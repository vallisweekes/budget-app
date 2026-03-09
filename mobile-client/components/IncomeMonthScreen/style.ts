import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { paddingBottom: 40 },
  sourcesHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sourcesTitle: { color: T.text, fontSize: 15, fontWeight: "900" },
  sourcesSub: { color: T.textDim, fontSize: 12, marginTop: 3, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyText: { color: T.text, fontSize: 15, fontWeight: "800" },
  emptySub: { color: T.textDim, fontSize: 13, fontWeight: "600" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});
