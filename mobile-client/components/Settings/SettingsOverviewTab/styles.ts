import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: T.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: { color: T.onAccent, fontSize: 34, fontWeight: "900" },
  avatarWrap: {
    position: "relative",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: `${T.card}CC`,
  },
  profileHeaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    marginTop: 2,
  },
  profileName: { color: T.text, fontSize: 36, fontWeight: "900", textAlign: "center" },
});