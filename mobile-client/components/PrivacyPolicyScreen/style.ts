import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "800" },
  headerSpacer: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  heroCard: {
    ...cardBase,
    padding: 16,
    marginBottom: 12,
  },
  updatedAt: { color: T.textDim, fontSize: 12, fontWeight: "700", marginBottom: 10 },
  intro: { color: T.text, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  sectionCard: {
    ...cardBase,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { color: T.text, fontSize: 17, fontWeight: "800", marginBottom: 10 },
  body: { color: T.textDim, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.accent,
    marginTop: 8,
  },
  bulletText: { flex: 1, color: T.textDim, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  termsBtn: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: T.accent,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  termsBtnText: { color: T.onAccent, fontSize: 14, fontWeight: "800" },
});