import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  card: {
    backgroundColor: T.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: T.accentBorder,
    alignItems: "center",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  total: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  caption: {
    marginTop: 8,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  centerTop: {
    color: T.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  centerValue: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  legend: {
    width: "100%",
    marginTop: 12,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 8,
  },
  legendValue: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
  },
});
