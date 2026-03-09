import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: T.card,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  yAxisLabels: {
    position: "absolute",
    left: 8,
    top: 0,
    bottom: 38,
    width: 38,
  },
  yAxisText: {
    position: "absolute",
    color: T.textDim,
    fontSize: 10,
    fontWeight: "700",
  },
  xLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 42,
    paddingRight: 12,
    marginTop: -6,
  },
  xLabelText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
});
