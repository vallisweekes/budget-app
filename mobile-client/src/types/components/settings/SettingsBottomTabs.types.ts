import type React from "react";
import { Ionicons } from "@expo/vector-icons";

import type { SettingsTab } from "@/types/settings";

export type SettingsBottomTabsTabItem = { id: SettingsTab; label: string };

export type SettingsBottomTabsProps = {
  activeTab: SettingsTab;
  primaryTabs: SettingsBottomTabsTabItem[];
  tabIcons: Record<SettingsTab, { active: React.ComponentProps<typeof Ionicons>["name"]; inactive: React.ComponentProps<typeof Ionicons>["name"] }>;
  isMoreTabActive: boolean;
  insetBottom: number;
  onSelectTab: (tab: SettingsTab) => void;
  onOpenMore: () => void;
};