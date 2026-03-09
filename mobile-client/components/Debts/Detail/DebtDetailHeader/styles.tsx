import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: "#2a0a9e",
  },
  headerTitle: { flex: 1, color: "#ffffff", fontSize: 17, fontWeight: "900", marginLeft: 4 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerActionsPlaceholder: { width: 74 },
  backBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
});
