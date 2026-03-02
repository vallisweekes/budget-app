import type React from "react";
import { Ionicons } from "@expo/vector-icons";

export interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  negative?: boolean;
}
