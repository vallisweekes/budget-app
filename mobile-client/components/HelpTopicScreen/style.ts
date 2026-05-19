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
    gap: 10,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: T.text,
    fontSize: 24,
    fontWeight: "900",
  },
  heroText: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    ...cardElevated,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionBody: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: T.accent,
  },
  bulletText: {
    flex: 1,
    color: T.text,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    ...cardElevated,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: T.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
});