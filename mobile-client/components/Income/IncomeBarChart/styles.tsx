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
  },
  xLabelText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  tooltipCard: {
    backgroundColor: "rgba(20, 20, 20, 0.96)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
    marginTop: 10,
  },
  tooltipExpenseName: {
    color: T.onAccent,
    fontSize: 12,
    fontWeight: "800",
  },
  tooltipExpenseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
    gap: 8,
  },
  tooltipExpensePlan: {
    flex: 1,
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
  tooltipExpenseAmount: {
    color: T.onAccent,
    fontSize: 11,
    fontWeight: "800",
  },
  tooltipMore: {
    color: T.onAccent,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
  },
  tooltipMeta: {
    color: T.onAccent,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 8,
  },
});
