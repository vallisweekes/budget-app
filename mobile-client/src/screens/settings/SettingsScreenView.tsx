import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MainTabScreenProps } from "@/navigation/types";
import useSettingsScreenController from "@/lib/hooks/useSettingsScreenController";
import SettingsMainContent from "@/components/Settings/SettingsMainContent";
import SettingsModalStack from "@/components/Settings/SettingsModalStack";
import {
  getAddPotLabel,
  getSavingsTilePalette,
  SAVINGS_TILE_SIZE,
} from "@/lib/helpers/settingsView";
import { styles } from "./styles";

export default function SettingsScreen({ navigation, route }: MainTabScreenProps<"Settings">) {
  const controller = useSettingsScreenController({ navigation, route });

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.content}>
        <SettingsMainContent
          controller={controller}
          navigation={navigation}
          savingsTileSize={SAVINGS_TILE_SIZE}
          getAddPotLabel={getAddPotLabel}
          getSavingsTilePalette={getSavingsTilePalette}
        />
      </View>

      <SettingsModalStack controller={controller} />
    </SafeAreaView>
  );
}
