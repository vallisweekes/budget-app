import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  card: {
    flex: 1,
    ...cardElevated,
    padding: 16,
    minWidth: "44%",
    gap: 4,
  },
  cardPressed: { opacity: 0.7 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
  month: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monthActive: { color: T.text },
  currentBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: T.accentDim,
    borderWidth: 1,
    borderColor: T.accentFaint,
  },
  currentBadgeText: { color: T.text, fontSize: 10, fontWeight: "700" },
  amount: { color: T.text, fontSize: 17, fontWeight: "900" },
  count: { color: T.textDim, fontSize: 11, fontWeight: "600" },
  empty: { color: T.textMuted, fontSize: 16, fontWeight: "900" },
});
