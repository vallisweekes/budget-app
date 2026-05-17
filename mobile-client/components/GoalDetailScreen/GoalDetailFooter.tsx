import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GoalDetailFooterProps } from "@/types";
import { T } from "@/lib/theme";

import { styles } from "./style";

export default function GoalDetailFooter({ isDirty, saving, deleting, onDelete, onSave }: GoalDetailFooterProps) {
  const insets = useSafeAreaInsets();
  const saveDisabled = !isDirty || saving || deleting;

  return (
    <View style={[styles.bottomActionsWrap, { paddingBottom: insets.bottom + 12 }]}> 
      <View style={styles.bottomActionsRow}>
        <Pressable
          style={[styles.bottomActionBtn, saveDisabled && styles.disabled]}
          onPress={onSave}
          disabled={saveDisabled}
        >
          <BlurView intensity={34} tint="light" style={styles.bottomActionGlass}>
            <View style={[styles.bottomActionTint, styles.bottomActionTintSave]} pointerEvents="none" />
            <View style={[styles.bottomActionGlow, styles.bottomActionGlowSave]} pointerEvents="none" />
            <View style={styles.bottomActionInnerBorder} pointerEvents="none" />
            {saving ? <ActivityIndicator size="small" color={T.text} /> : <Text style={styles.bottomActionSaveText}>Save</Text>}
          </BlurView>
        </Pressable>
        <Pressable
          style={[styles.bottomActionBtn, (saving || deleting) && styles.disabled]}
          onPress={onDelete}
          disabled={saving || deleting}
        >
          <BlurView intensity={34} tint="light" style={styles.bottomActionGlass}>
            <View style={[styles.bottomActionTint, styles.bottomActionTintDelete]} pointerEvents="none" />
            <View style={[styles.bottomActionGlow, styles.bottomActionGlowDelete]} pointerEvents="none" />
            <View style={styles.bottomActionInnerBorder} pointerEvents="none" />
            {deleting ? <ActivityIndicator size="small" color={T.red} /> : <Text style={styles.bottomActionDeleteText}>Delete</Text>}
          </BlurView>
        </Pressable>
      </View>
    </View>
  );
}