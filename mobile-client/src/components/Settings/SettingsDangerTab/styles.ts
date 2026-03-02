import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(226,92,92,0.1)",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(226,92,92,0.2)",
  },
  signOutText: { color: T.red, fontSize: 15, fontWeight: "700" },
});
