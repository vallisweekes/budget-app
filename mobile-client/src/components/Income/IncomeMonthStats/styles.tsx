import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 14, marginTop: 10 },
  card: {
    flex: 1,
    ...cardBase,
    padding: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: T.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  valueInline: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  cardValue: { color: T.text, fontSize: 17, fontWeight: "900" },
  cardPctInline: { color: T.textDim, fontSize: 11, fontWeight: "800" },
  cardSubline: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  positive: { color: T.green },
  negative: { color: T.red },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeOn: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  badgeOver: { backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  badgeTextOn: { color: T.green },
  badgeTextOver: { color: T.red },
});
