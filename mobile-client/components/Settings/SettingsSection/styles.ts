import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  section: {
    ...cardBase,
    padding: 16,
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { color: T.textDim, fontSize: 13, fontWeight: "800" },
});
