import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  debtCard: {
    ...cardBase,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  debtCardBody: {
    flex: 1,
  },
  debtCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  debtLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  debtLogo: {
    width: "100%",
    height: "100%",
  },
  debtLogoFallback: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
  },
  debtTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  debtName: { color: T.text, fontSize: 15, fontWeight: "900", flex: 1 },
  availableAmount: {
    color: T.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },
  utilizationWrap: {
    marginTop: 12,
  },
  utilizationBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: `${T.border}66`,
    overflow: "hidden",
  },
  utilizationFill: {
    height: "100%",
    borderRadius: 999,
  },
  utilizationMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  utilizationMetaText: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  debtTypeBlock: {
    marginBottom: 12,
  },
  debtTypeCount: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  debtTypeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  debtTypeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.border}55`,
  },
  debtTypeTitle: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
});
