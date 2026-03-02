import { StyleSheet } from "react-native";

import { SETTINGS_MENU_BACKDROP } from "@/lib/constants";
import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  moreBackdrop: {
    flex: 1,
    backgroundColor: SETTINGS_MENU_BACKDROP,
    justifyContent: "flex-end",
    padding: 12,
  },
  moreMenu: {
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  moreMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  moreMenuItemActive: { backgroundColor: T.accentFaint },
  moreMenuTxt: { color: T.text, fontSize: 14, fontWeight: "700" },
  moreMenuTxtActive: { color: T.accent },
});
