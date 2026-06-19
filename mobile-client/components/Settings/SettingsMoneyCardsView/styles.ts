import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase, cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  addCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    shadowColor: T.accent,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addCardBtnText: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "900",
  },
  cardsSummaryCard: {
    ...cardElevated,
    padding: 16,
    marginBottom: 14,
    borderColor: `${T.accent}20`,
    backgroundColor: `${T.card}F7`,
  },
  cardsSummaryChartCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardsSummaryChartLabel: {
    color: T.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardsSummaryChartValue: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  cardsSummaryCopy: {
    flex: 1,
    paddingRight: 12,
  },
  cardsSummaryEyebrow: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  cardsSummaryFootnote: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 12,
  },
  cardsSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardsSummaryLegend: {
    marginTop: 12,
    gap: 10,
  },
  cardsSummaryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  cardsSummaryLegendLabel: {
    flex: 1,
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 8,
  },
  cardsSummaryLegendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardsSummaryLegendValue: {
    color: T.text,
    fontSize: 12,
    fontWeight: "800",
  },
  cardsSummaryPrimaryLabel: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  cardsSummaryPrimaryValue: {
    color: T.green,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 8,
  },
  cardsSummaryUtilisation: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  cardsSummaryStat: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: `${T.cardAlt}BB`,
    borderWidth: 1,
    borderColor: `${T.border}88`,
  },
  cardsSummaryStatLabel: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 5,
  },
  cardsSummaryStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cardsSummaryStatValue: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
  },
  moneySectionCard: {
    ...cardElevated,
    padding: 14,
    marginBottom: 14,
    borderColor: `${T.accent}20`,
    backgroundColor: `${T.card}F7`,
  },
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  plainBudgetTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
    paddingHorizontal: 2,
    letterSpacing: 0.2,
  },
  plainSavingsBlock: {
    marginBottom: 16,
  },
  plainSectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
});
