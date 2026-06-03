import type { TextStyle, ViewStyle } from "react-native";
import { T } from "@/lib/theme";

export const CARD_RADIUS = 22;

export const cardBase: ViewStyle = {
  backgroundColor: "rgba(26,30,40,0.56)",
  borderRadius: CARD_RADIUS,
  borderWidth: 1,
  borderColor: "rgba(232,238,250,0.28)",
};

export const cardElevated: ViewStyle = {
  ...cardBase,
  shadowColor: "#000000",
  shadowOpacity: 0.3,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 14 },
  elevation: 12,
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

export const flatInputLabel: TextStyle = {
  color: "rgba(244,246,255,0.74)",
  fontSize: 12,
  fontWeight: "800",
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

export const flatInput: TextStyle = {
  backgroundColor: "transparent",
  borderRadius: 0,
  paddingHorizontal: 0,
  paddingVertical: 10,
  color: "#f4f6ff",
  fontSize: 18,
  fontWeight: "500",
  borderWidth: 0,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.72)",
  minHeight: 52,
};

export const flatInputDisabled: TextStyle = {
  ...flatInput,
  color: "rgba(244,246,255,0.50)",
  borderBottomColor: "rgba(255,255,255,0.20)",
};
