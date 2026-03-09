import { Dimensions, StyleSheet } from "react-native";

import { T } from "@/lib/theme";

const MONEY_TOGGLE_WIDTH = Math.max(220, Dimensions.get("window").width - 32);
const MONEY_TOGGLE_TRACK_PADDING = 4;
const MONEY_TOGGLE_SEGMENT_WIDTH = (MONEY_TOGGLE_WIDTH - MONEY_TOGGLE_TRACK_PADDING * 2) / 2;

export const styles = StyleSheet.create({
  moneyTabSurface: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
    marginBottom: 8,
  },
  moneyTogglePill: {
    width: MONEY_TOGGLE_SEGMENT_WIDTH,
    borderRadius: 999,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  moneyToggleThumb: {
    position: "absolute",
    left: MONEY_TOGGLE_TRACK_PADDING,
    top: MONEY_TOGGLE_TRACK_PADDING,
    width: MONEY_TOGGLE_SEGMENT_WIDTH,
    height: 33,
    borderRadius: 999,
    backgroundColor: `${T.accent}30`,
    borderWidth: 1,
    borderColor: `${T.accent}73`,
  },
  moneyToggleTxt: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
  },
  moneyToggleTxtActive: {
    color: T.text,
  },
  moneyToggleWrap: {
    flexDirection: "row",
    width: MONEY_TOGGLE_WIDTH,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    backgroundColor: T.cardAlt,
    padding: MONEY_TOGGLE_TRACK_PADDING,
    marginBottom: 20,
    position: "relative",
  },
});
