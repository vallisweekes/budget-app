import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";
import { cardElevated, textLabel, textValue } from "@/lib/ui";

export const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "44%",
    padding: 16,
    ...cardElevated,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  labelTop: { marginBottom: 4 },
  value: { ...textValue },
  neg: { color: T.red },
  label: { ...textLabel },
});
