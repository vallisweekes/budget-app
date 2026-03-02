import React from "react";

import SettingsModalStackActions from "@/components/Settings/SettingsModalStackActions";
import SettingsModalStackEditors from "@/components/Settings/SettingsModalStackEditors";

import type { SettingsModalStackProps } from "@/types/components/settings/SettingsModalStack.types";

export default function SettingsModalStack({ controller }: SettingsModalStackProps) {
  return (
    <>
      <SettingsModalStackEditors controller={controller} />
      <SettingsModalStackActions controller={controller} />
    </>
  );
}
