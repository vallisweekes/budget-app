import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    flex: 1,
    backgroundColor: T.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 36,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    color: T.red,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "700",
  },
  retryText: {
    color: T.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  summaryCard: {
    ...cardElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244,246,255,0.16)",
    backgroundColor: "rgba(20,24,38,0.56)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  summaryTitle: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  summaryMetaValue: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  summaryMetaLabel: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryAmount: {
    color: T.text,
    fontSize: 17,
    fontWeight: "800",
  },
  listCard: {
    ...cardElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244,246,255,0.16)",
    backgroundColor: "rgba(20,24,38,0.56)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionTitle: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(244,246,255,0.1)",
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(244,246,255,0.14)",
    backgroundColor: "rgba(24,31,49,0.56)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  avatarText: {
    color: T.text,
    fontSize: 13,
    fontWeight: "800",
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: T.text,
    fontSize: 15,
    fontWeight: "800",
  },
  rowSubtitle: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
  rowAmount: {
    color: T.text,
    fontSize: 16,
    fontWeight: "800",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyCard: {
    ...cardElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244,246,255,0.16)",
    backgroundColor: "rgba(20,24,38,0.56)",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
