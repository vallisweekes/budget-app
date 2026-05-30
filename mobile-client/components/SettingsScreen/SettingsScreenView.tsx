import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MainTabScreenProps } from "@/navigation/types";
import { useSettingsScreenController } from "@/hooks";
import { useAppTranslation } from "@/hooks";
import SettingsMainContent from "@/components/Settings/SettingsMainContent";
import SettingsModalStack from "@/components/Settings/SettingsModalStack";
import {
  getAddPotLabel,
  getSavingsTilePalette,
  SAVINGS_TILE_SIZE,
} from "@/lib/helpers/settingsView";
import { styles } from "./style";

export default function SettingsScreen({ navigation, route }: MainTabScreenProps<"Settings">) {
  const controller = useSettingsScreenController({ navigation, route });
  const { t } = useAppTranslation(controller.settings?.language);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.content}>
        <SettingsMainContent
          controller={controller}
          navigation={navigation}
          savingsTileSize={SAVINGS_TILE_SIZE}
          getAddPotLabel={(field) => getAddPotLabel(field, t)}
          getSavingsTilePalette={getSavingsTilePalette}
        />
      </View>

      <SettingsModalStack controller={controller} />
    </SafeAreaView>
  );
}
