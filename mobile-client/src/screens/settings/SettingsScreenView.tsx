import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MainTabScreenProps } from "@/navigation/types";
import useSettingsScreenController from "@/lib/hooks/useSettingsScreenController";
import SettingsBottomTabs from "@/components/Settings/SettingsBottomTabs";
import SettingsMainContent from "@/components/Settings/SettingsMainContent";
import SettingsModalStack from "@/components/Settings/SettingsModalStack";
import SettingsMoreTabsMenu from "@/components/Settings/SettingsMoreTabsMenu";
import {
  getAddPotLabel,
  getSavingsTilePalette,
  MORE_TABS,
  PRIMARY_TABS,
  SAVINGS_TILE_SIZE,
  TAB_ICONS,
} from "@/lib/helpers/settingsView";
import { styles } from "./styles";

export default function SettingsScreen({ navigation, route }: MainTabScreenProps<"Settings">) {
  const controller = useSettingsScreenController({ navigation, route });
  const { insets, activeTab, setActiveTab, moreOpen, setMoreOpen, isMoreTabActive, safeTopPadding } = controller;

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: safeTopPadding }]} edges={[]}>
      <View style={styles.content}>
        <SettingsMainContent
          controller={controller}
          navigation={navigation}
          savingsTileSize={SAVINGS_TILE_SIZE}
          getAddPotLabel={getAddPotLabel}
          getSavingsTilePalette={getSavingsTilePalette}
        />
      </View>

      <SettingsBottomTabs
        activeTab={activeTab}
        primaryTabs={PRIMARY_TABS}
        tabIcons={TAB_ICONS}
        isMoreTabActive={isMoreTabActive}
        insetBottom={insets.bottom}
        onSelectTab={setActiveTab}
        onOpenMore={() => setMoreOpen(true)}
      />

      <SettingsMoreTabsMenu
        visible={moreOpen}
        activeTab={activeTab}
        tabs={MORE_TABS}
        onClose={() => setMoreOpen(false)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setMoreOpen(false);
        }}
      />

      <SettingsModalStack controller={controller} />
    </SafeAreaView>
  );
}
