import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,40,47,0.10)",
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12, gap: 10 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(15,40,47,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,40,47,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#0f282f", fontSize: 14, fontWeight: "900" },
  label: { color: "rgba(15,40,47,0.70)", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  value: { color: "#0f282f", fontSize: 14, fontWeight: "800" },
  sub: { color: "rgba(15,40,47,0.48)", fontSize: 12, fontWeight: "700" },
});
