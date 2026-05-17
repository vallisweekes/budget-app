import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.08)" },
  lbl: { color: T.textDim, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  val: { color: T.text, fontSize: 17, fontWeight: "900", marginTop: 4, letterSpacing: -0.3 },
  assumption: { color: T.textDim, fontSize: 12, fontWeight: "700", marginTop: 8, textAlign: "center" },
  warn: { color: T.orange, fontSize: 12, fontWeight: "700", marginTop: 10, textAlign: "center" },
});
