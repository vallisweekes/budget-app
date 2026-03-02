import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";

export const styles = StyleSheet.create({
  muted: { color: T.textDim, fontSize: 13, marginTop: 8 },
  notificationActionBtn: {
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  notificationActionText: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: "800",
  },
  notificationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationBody: {
    color: T.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  notificationDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${T.red}66`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${T.red}14`,
  },
  notificationEmpty: {
    color: T.textMuted,
    fontSize: 12,
  },
  notificationFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationHeading: {
    marginBottom: 6,
  },
  notificationItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  notificationItemPressed: {
    opacity: 0.9,
  },
  notificationItemUnread: {
    borderColor: `${T.accent}80`,
  },
  notificationList: {
    gap: 8,
    marginTop: 0,
    marginBottom: 8,
  },
  notificationMeta: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  notificationTitle: {
    color: T.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.red,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    gap: 10,
  },
  rowLabel: { color: T.textDim, fontSize: 14, fontWeight: "700" },
});
