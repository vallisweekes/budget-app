import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCardMini: {
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: T.accentBorder,
    width: "48%",
    minHeight: 98,
    justifyContent: "space-between",
  },
  statLabel: { color: T.textDim, fontSize: 11, fontWeight: "800", marginBottom: 4 },
  statValue: { color: T.text, fontSize: 16, fontWeight: "900" },
  statSub: { color: T.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
});
