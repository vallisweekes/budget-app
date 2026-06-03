import { Dimensions, StyleSheet } from "react-native";

import { T } from "@/lib/theme";

const MONEY_TOGGLE_WIDTH = Math.max(220, Dimensions.get("window").width - 32);
const MONEY_TOGGLE_TRACK_PADDING = 4;
const MONEY_TOGGLE_SEGMENT_WIDTH = (MONEY_TOGGLE_WIDTH - MONEY_TOGGLE_TRACK_PADDING * 2) / 2;

export const styles = StyleSheet.create({
  moneyTabSurface: {
    marginBottom: 10,
  },
  moneyTogglePill: {
    width: MONEY_TOGGLE_SEGMENT_WIDTH,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moneyToggleThumb: {
    position: "absolute",
    left: MONEY_TOGGLE_TRACK_PADDING,
    top: MONEY_TOGGLE_TRACK_PADDING,
    width: MONEY_TOGGLE_SEGMENT_WIDTH,
    height: 35,
    borderRadius: 999,
    backgroundColor: `${T.accent}36`,
    borderWidth: 1,
    borderColor: `${T.accent}7D`,
    shadowColor: T.accent,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  moneyToggleTxt: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  moneyToggleTxtActive: {
    color: T.text,
  },
  moneyToggleWrap: {
    flexDirection: "row",
    width: MONEY_TOGGLE_WIDTH,
    borderWidth: 1,
    borderColor: `${T.accent}2A`,
    borderRadius: 999,
    backgroundColor: `${T.cardAlt}D8`,
    padding: MONEY_TOGGLE_TRACK_PADDING,
    marginBottom: 18,
    position: "relative",
  },
});
