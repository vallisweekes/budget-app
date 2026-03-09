import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  logoArea: { alignItems: "center", marginBottom: 36 },
  appName: { color: T.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  tagline: { color: T.textDim, fontSize: 14, marginTop: 6, fontWeight: "600" },
  card: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  modeRow: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: T.cardAlt,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: T.accent },
  modeBtnText: { color: T.textDim, fontWeight: "800", fontSize: 14 },
  modeBtnTextActive: { color: T.onAccent },
  input: {
    backgroundColor: T.cardAlt,
    color: T.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: T.onAccent, fontWeight: "700", fontSize: 16 },
  apiNote: {
    marginTop: 16,
    color: T.textDim,
    fontSize: 11,
    textAlign: "center",
  },
  apiNoteError: { color: T.orange },
});