import React from "react";
import { Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsBottomTabsProps } from "@/types/components/settings/SettingsBottomTabs.types";

export default function SettingsBottomTabs({ activeTab, primaryTabs, tabIcons, isMoreTabActive, insetBottom, onSelectTab, onOpenMore }: SettingsBottomTabsProps) {
  return (
    <BlurView intensity={22} tint="dark" style={[styles.bottomTabsGlass, { paddingBottom: Math.max(0, insetBottom) }]}> 
      <View style={styles.bottomTabsTint} />
      <View style={styles.bottomTabs}>
        {primaryTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => onSelectTab(tab.id)} style={styles.bottomTabBtn}>
              <View style={[styles.bottomIconWrap, active && styles.bottomIconWrapActive]}>
                <Ionicons name={active ? tabIcons[tab.id].active : tabIcons[tab.id].inactive} size={18} color={active ? T.text : T.textDim} />
              </View>
              {!active ? <Text style={styles.bottomTabTxt}>{tab.label}</Text> : null}
            </Pressable>
          );
        })}
        <Pressable onPress={onOpenMore} style={styles.bottomTabBtn}>
          <View style={[styles.bottomIconWrap, isMoreTabActive && styles.bottomIconWrapActive]}>
            <Ionicons name={isMoreTabActive ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"} size={18} color={isMoreTabActive ? T.text : T.textDim} />
          </View>
          {!isMoreTabActive ? <Text style={styles.bottomTabTxt}>More</Text> : null}
        </Pressable>
      </View>
    </BlurView>
  );
}
