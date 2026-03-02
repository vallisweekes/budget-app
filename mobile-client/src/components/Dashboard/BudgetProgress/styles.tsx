import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase, textCaption, textLabel } from "@/lib/ui";

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    ...cardBase,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  title: { ...textLabel },
  pct: { color: T.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.1 },
  over: { color: T.red },
  bg: { height: 12, backgroundColor: T.border, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  sub: { ...textCaption, marginTop: 10 },
});
