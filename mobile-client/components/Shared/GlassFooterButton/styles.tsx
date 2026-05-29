import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  glass: {
    width: "100%",
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.78)",
    overflow: "hidden",
  },
  glassDark: {
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(70,75,96,0.72)",
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  tintDark: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
  },
  innerBorderDark: {
    borderColor: "rgba(255,255,255,0.12)",
  },
  label: {
    fontSize: 15,
    fontWeight: "900",
  },
  labelLight: {
    color: "#ffffff",
  },
  labelDark: {
    color: "#111827",
  },
  labelDanger: {
    color: T.red,
  },
});