import { Ionicons } from "@expo/vector-icons";

export function getGoalIconName(title: string): keyof typeof Ionicons.glyphMap {
  const normalizedTitle = String(title ?? "").toLowerCase();
  if (normalizedTitle.includes("emergency")) return "shield-outline";
  if (normalizedTitle.includes("saving")) return "cash-outline";
  return "flag-outline";
}