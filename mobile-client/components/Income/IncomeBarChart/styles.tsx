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
  chartArea: {
    position: "relative",
  },
  chartTouchLayer: {
    position: "absolute",
    zIndex: 2,
  },
  tooltipSlot: {
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  yAxisLabels: {
    position: "absolute",
    left: 0,
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
    gap: 6,
  },
  xLabelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 5,
  },
  xLabelDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  xLabelText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  xLabelTextActive: {
    color: T.text,
  },
  tooltipCard: {
    backgroundColor: "rgba(24, 24, 24, 0.97)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tooltipCardInline: {
    position: "relative",
  },
  tooltipTitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tooltipTotal: {
    color: T.onAccent,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  tooltipExpenseBlock: {
    marginTop: 2,
    marginBottom: 10,
  },
  tooltipExpenseName: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "800",
  },
  tooltipExpenseMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  tooltipMetricLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
  tooltipMetricValueMuted: {
    flex: 1,
    textAlign: "right",
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "600",
  },
  tooltipMetricValue: {
    color: T.onAccent,
    fontSize: 11,
    fontWeight: "800",
  },
  tooltipMore: {
    color: T.onAccent,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  tooltipMeta: {
    color: T.onAccent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 8,
  },
});
