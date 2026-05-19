import { StyleSheet } from "react-native";

import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    ...cardElevated,
    padding: 18,
    gap: 8,
  },
  heroEyebrow: {
    color: T.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  heroText: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  cardList: {
    gap: 12,
  },
  topicCard: {
    ...cardElevated,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topicCopy: {
    flex: 1,
    gap: 4,
  },
  topicTitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: "800",
  },
  topicDescription: {
    color: T.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
});