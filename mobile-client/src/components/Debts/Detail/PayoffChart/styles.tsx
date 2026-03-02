import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  strip: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: T.border },
  lbl: { color: T.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  val: { color: T.text, fontSize: 14, fontWeight: "900", marginTop: 2 },
  assumption: { color: T.textDim, fontSize: 11, fontWeight: "700", marginTop: 6, textAlign: "center" },
  warn: { color: T.orange, fontSize: 11, fontWeight: "600", marginTop: 8, textAlign: "center" },
});
