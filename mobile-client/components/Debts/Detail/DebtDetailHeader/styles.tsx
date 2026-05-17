import { StyleSheet } from "react-native";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: "rgba(22,26,45,0.7)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,92,255,0.22)",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(124,92,255,0.12)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: { flex: 1, color: T.text, fontSize: 17, fontWeight: "800", textAlign: "center", marginHorizontal: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerActionsPlaceholder: { width: 34 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});
