import React from "react";
import { View, Button, StyleSheet } from "react-native";

export type TabKey = "dashboard" | "expenses" | "settings";

interface BottomTabsProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export default function BottomTabs({ active, onChange }: BottomTabsProps) {
  return (
    <View style={styles.tabs}>
      <Button title="Dashboard" onPress={() => onChange("dashboard")}
        color={active === "dashboard" ? "#fff" : "#888"} />
      <Button title="Expenses" onPress={() => onChange("expenses")}
        color={active === "expenses" ? "#fff" : "#888"} />
      <Button title="Settings" onPress={() => onChange("settings")}
        color={active === "settings" ? "#fff" : "#888"} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#222",
    paddingVertical: 8,
  },
});
