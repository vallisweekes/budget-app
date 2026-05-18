import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  cardGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  cardGlowPrimary: {
    width: 148,
    height: 148,
    top: -64,
    right: -58,
    backgroundColor: `${T.accent}1C`,
  },
  cardGlowSecondary: {
    width: 108,
    height: 108,
    bottom: -44,
    left: -34,
    backgroundColor: `${T.onAccent}08`,
  },
  hint: {
    color: T.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  inlineAction: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: `${T.accent}5A`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: `${T.accent}18`,
  },
  inlineActionDisabled: {
    opacity: 0.46,
  },
  inlineActionText: {
    color: T.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  localeRowsCard: {
    borderWidth: 1,
    borderColor: `${T.accent}26`,
    borderRadius: 16,
    backgroundColor: `${T.cardAlt}D5`,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  muted: {
    color: T.textDim,
    fontSize: 14,
    marginTop: 8,
    fontWeight: "600",
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: `${T.accent}40`,
    backgroundColor: `${T.accent}16`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  outlineBtnText: {
    color: T.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
