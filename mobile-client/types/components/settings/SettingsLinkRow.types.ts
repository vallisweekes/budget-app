import type React from "react";
import type { Ionicons } from "@expo/vector-icons";

export type SettingsLinkRowProps = {
  label: string;
  value?: string | null;
  valueColor?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  danger?: boolean;
};