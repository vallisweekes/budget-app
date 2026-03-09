import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 10,
    ...cardBase,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: "center" },
  label: { color: T.textDim, fontSize: 10, marginBottom: 2, fontWeight: "700" },
  value: { color: T.text, fontSize: 12, fontWeight: "900" },
});
