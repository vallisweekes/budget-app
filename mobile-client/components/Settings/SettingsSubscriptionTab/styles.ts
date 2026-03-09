import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
  currentCard: {
    ...cardElevated,
    padding: 16,
    gap: 6,
  },
  eyebrow: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  currentTitle: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
  },
  currentText: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  currentHint: {
    color: T.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  offerCard: {
    ...cardElevated,
    padding: 16,
    gap: 10,
    borderColor: T.border,
  },
  offerCardHighlight: {
    borderColor: `${T.accent}99`,
  },
  offerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  offerTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "900",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: `${T.accent}20`,
  },
  badgeText: {
    color: T.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  price: {
    color: T.text,
    fontSize: 22,
    fontWeight: "900",
  },
  billing: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  bullet: {
    color: T.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  disabledBtn: {
    marginTop: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.cardAlt,
    borderWidth: 1,
    borderColor: T.border,
  },
  disabledBtnText: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: T.red,
    fontSize: 14,
    lineHeight: 20,
  },
  retryBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: T.accent,
  },
  retryText: {
    color: T.onAccent,
    fontSize: 13,
    fontWeight: "800",
  },
});