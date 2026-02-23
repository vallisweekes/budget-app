import type { TextStyle, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const CARD_RADIUS = 22;

export const cardBase: ViewStyle = {
  backgroundColor: T.card,
  borderRadius: CARD_RADIUS,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: T.border,
};

export const cardElevated: ViewStyle = {
  ...cardBase,
  shadowColor: "#000000",
  shadowOpacity: 0.16,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};

export const textTitle: TextStyle = {
  color: T.text,
  fontSize: 16,
  fontWeight: "900",
  letterSpacing: -0.2,
};

export const textValue: TextStyle = {
  color: T.text,
  fontSize: 22,
  fontWeight: "900",
  letterSpacing: -0.2,
};

export const textLabel: TextStyle = {
  color: T.textDim,
  fontSize: 12,
  fontWeight: "700",
  letterSpacing: 0,
};

export const textCaption: TextStyle = {
  color: T.textDim,
  fontSize: 12,
  fontWeight: "600",
};
