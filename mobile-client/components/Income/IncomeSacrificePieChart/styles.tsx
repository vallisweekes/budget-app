import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

const SIZE = 210;

export const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    alignItems: "center",
  },
  chartWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerTitle: {
    color: T.textDim,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  centerValue: {
    color: T.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  legend: {
    width: "100%",
    gap: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    color: T.text,
    fontSize: 12,
    fontWeight: "700",
  },
  legendValue: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
});
