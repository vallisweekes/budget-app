import { StyleSheet } from "react-native";

import { SETTINGS_DANGER_BG, SETTINGS_DANGER_BORDER } from "@/lib/constants";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: SETTINGS_DANGER_BG,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: SETTINGS_DANGER_BORDER,
  },
  resetText: { color: T.red, fontSize: 15, fontWeight: "800" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: SETTINGS_DANGER_BG,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: SETTINGS_DANGER_BORDER,
  },
  signOutText: { color: T.red, fontSize: 15, fontWeight: "700" },
});
