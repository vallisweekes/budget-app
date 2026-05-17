import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    position: "relative",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  headerSpacer: {
    flex: 1,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.3,
  },
  headerSubValue: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 6,
  },
  headerPct: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  headerPctValue: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
  headerPctValueGood: {
    color: T.green,
  },
  headerPctSuffix: {
    color: T.text,
    fontSize: 12,
    fontWeight: "700",
  },
  headerSub: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 220,
  },
  chartArea: {
    position: "relative",
  },
  chartTouchLayer: {
    position: "absolute",
    zIndex: 2,
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
    paddingVertical: 8,
    borderRadius: 16,
    gap: 5,
  },
  xLabelButtonActive: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  xLabelDot: {
    width: 10,
    height: 10,
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
});
