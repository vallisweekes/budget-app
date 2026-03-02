import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

const INDICATOR_SIZE = 46;
const BAR_HORIZONTAL_PADDING = 8;
const INDICATOR_VERTICAL_OFFSET = -2;

export const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  glassBase: {
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: `${T.accent}29`,
    backgroundColor: `${T.card}A8`,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${T.accent}12`,
  },
  bar: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
  },
  liquidIndicator: {
    position: "absolute",
    overflow: "hidden",
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: `${T.accent}30`,
    borderWidth: 1,
    borderColor: `${T.accent}73`,
    shadowColor: T.accent,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 7,
  },
  liquidInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 1,
    borderColor: `${T.text}14`,
    backgroundColor: `${T.text}08`,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    borderRadius: 12,
    zIndex: 1,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: INDICATOR_SIZE,
  },
  tabContentActive: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    transform: [{ translateY: INDICATOR_VERTICAL_OFFSET }],
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
