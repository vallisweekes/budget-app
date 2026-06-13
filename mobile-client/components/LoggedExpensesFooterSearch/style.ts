import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 12,
  },
  searchPill: {
    height: 56,
    minWidth: 250,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.72)",
    backgroundColor: "rgba(28, 31, 49, 0.72)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    shadowColor: T.accent,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  input: {
    flex: 1,
    minHeight: 44,
    color: T.text,
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 10,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
});