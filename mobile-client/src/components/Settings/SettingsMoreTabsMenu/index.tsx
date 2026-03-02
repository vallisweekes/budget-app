import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { styles } from "./styles";

import type { SettingsMoreTabsMenuProps } from "@/types/components/settings/SettingsMoreTabsMenu.types";

export default function SettingsMoreTabsMenu({ visible, activeTab, tabs, onClose, onSelectTab }: SettingsMoreTabsMenuProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.moreBackdrop}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <View style={styles.moreMenu}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable key={tab.id} onPress={() => onSelectTab(tab.id)} style={[styles.moreMenuItem, active && styles.moreMenuItemActive]}>
                <Text style={[styles.moreMenuTxt, active && styles.moreMenuTxtActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
