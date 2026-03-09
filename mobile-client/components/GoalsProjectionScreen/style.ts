import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 24 },
  stateText: { color: T.textDim, fontSize: 14, fontWeight: "700" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center" },
  retryBtn: { marginTop: 10, backgroundColor: T.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "800" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: T.text, fontSize: 18, fontWeight: "900" },
  headerSpacer: { width: 22 },
  scroll: { padding: 16, paddingBottom: 40 },
  chartCard: {
    ...cardElevated,
    padding: 14,
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 999 },
  legendTxt: { color: T.textDim, fontSize: 11, fontWeight: "700" },
  axisRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  axisTxt: { color: T.textMuted, fontSize: 11, fontWeight: "700" },
  emptyCard: {
    ...cardElevated,
    padding: 16,
    gap: 6,
  },
  emptyTitle: { color: T.text, fontSize: 15, fontWeight: "900" },
  emptyDetail: { color: T.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },
});