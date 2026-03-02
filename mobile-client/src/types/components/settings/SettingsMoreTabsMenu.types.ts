import type { SettingsTab } from "@/types/settings";

export type SettingsMoreTabsMenuTabItem = { id: SettingsTab; label: string };

export type SettingsMoreTabsMenuProps = {
  visible: boolean;
  activeTab: SettingsTab;
  tabs: SettingsMoreTabsMenuTabItem[];
  onClose: () => void;
  onSelectTab: (tab: SettingsTab) => void;
};
