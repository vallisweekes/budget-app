import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCardMini: {
    backgroundColor: "rgba(20,24,38,0.56)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    width: "48%",
    minHeight: 112,
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  statLabel: { color: T.textDim, fontSize: 11, fontWeight: "900", marginBottom: 8, letterSpacing: 0.3 },
  statValue: { color: T.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  statSub: { color: T.textMuted, fontSize: 12, fontWeight: "700", marginTop: 6 },
});
