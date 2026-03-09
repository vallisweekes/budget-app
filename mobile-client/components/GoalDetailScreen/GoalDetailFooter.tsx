import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { T } from "@/lib/theme";

import { styles } from "./style";

type GoalDetailFooterProps = {
  isDirty: boolean;
  saving: boolean;
  deleting: boolean;
  onDelete: () => void;
  onSave: () => void;
};

export default function GoalDetailFooter({ isDirty, saving, deleting, onDelete, onSave }: GoalDetailFooterProps) {
  return (
    <View style={styles.bottomActionsWrap}>
      <View style={styles.bottomActionsRow}>
        <Pressable
          style={[styles.bottomActionBtn, styles.bottomActionBtnDelete, deleting && styles.disabled]}
          onPress={onDelete}
          disabled={saving || deleting}
        >
          {deleting ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.bottomActionDeleteText}>Delete</Text>}
        </Pressable>
        <Pressable
          style={[styles.bottomActionBtn, styles.bottomActionBtnSave, (!isDirty || saving) && styles.disabled]}
          onPress={onSave}
          disabled={!isDirty || saving || deleting}
        >
          {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.bottomActionSaveText}>Save changes</Text>}
        </Pressable>
      </View>
    </View>
  );
}