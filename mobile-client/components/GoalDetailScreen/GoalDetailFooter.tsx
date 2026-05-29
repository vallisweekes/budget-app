import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GoalDetailFooterProps } from "@/types";
import { T } from "@/lib/theme";
import GlassFooterButton from "@/components/Shared/GlassFooterButton";

import { styles } from "./style";

export default function GoalDetailFooter({ isDirty, saving, deleting, onDelete, onSave }: GoalDetailFooterProps) {
  const insets = useSafeAreaInsets();
  const saveDisabled = !isDirty || saving || deleting;

  return (
    <View style={[styles.bottomActionsWrap, { paddingBottom: insets.bottom + 12 }]}> 
      <View style={styles.bottomActionsRow}>
        <GlassFooterButton
          label="Save"
          onPress={onSave}
          disabled={saveDisabled}
          loading={saving}
          variant="light"
          tone="dark"
          containerStyle={styles.bottomActionBtn}
          loadingColor={T.text}
        />
        <GlassFooterButton
          label="Delete"
          onPress={onDelete}
          disabled={saving || deleting}
          loading={deleting}
          variant="dark"
          tone="light"
          containerStyle={styles.bottomActionBtn}
          loadingColor={T.red}
        />
      </View>
    </View>
  );
}