import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: T.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: T.onAccent, fontSize: 22, fontWeight: "700" },
  outlineBtn: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  outlineBtnText: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  profileBody: {
    flex: 1,
    gap: 2,
  },
  profileCard: {
    ...cardElevated,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  profileMeta: { color: T.textMuted, fontSize: 12, fontWeight: "600" },
  profileName: { color: T.text, fontSize: 18, fontWeight: "900" },
  profileSub: { color: T.textDim, fontSize: 13, marginTop: 2, fontWeight: "600" },
});