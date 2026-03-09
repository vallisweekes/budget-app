import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#2d2860",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 2,
  },
  accent: {
    width: 6,
    backgroundColor: "#f8bf6a",
  },
  text: {
    color: "#f1f2ff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
