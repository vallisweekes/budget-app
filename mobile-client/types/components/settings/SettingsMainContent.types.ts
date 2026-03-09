import type { SettingsScreenController } from "@/lib/hooks/useSettingsScreenController";
import type { MainTabScreenProps } from "@/navigation/types";

export type SettingsMainContentProps = {
  controller: SettingsScreenController;
  navigation: MainTabScreenProps<"Settings">["navigation"];
  savingsTileSize: number;
  getAddPotLabel: (field: "savings" | "emergency" | "investment") => string;
  getSavingsTilePalette: (field: "savings" | "emergency" | "investment") => {
    cardBg: string;
    borderColor: string;
    iconBg: string;
    titleColor: string;
    valueColor: string;
    hintColor: string;
    plusColor: string;
  };
};
