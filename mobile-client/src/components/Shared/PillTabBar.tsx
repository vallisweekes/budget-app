import React from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  Dashboard: { active: "home", inactive: "home-outline" },
  Income:    { active: "wallet", inactive: "wallet-outline" },
  Expenses:  { active: "receipt", inactive: "receipt-outline" },
  Debts:     { active: "card", inactive: "card-outline" },
};

const LABELS: Record<string, string> = {
  Dashboard: "Home",
  Income:    "Income",
  Expenses:  "Expenses",
  Debts:     "Debts",
};

export default function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((r) => {
    const opts = descriptors[r.key].options as Record<string, unknown>;
    return opts.tabBarButton == null;
  });

  return (
    <View style={[s.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={s.bar}>
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index].name === route.name;
          const icons = ICONS[route.name] ?? { active: "ellipse", inactive: "ellipse-outline" };
          const label = LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={s.tab}
              android_ripple={{ color: "rgba(15,40,47,0.08)", borderless: false }}
            >
              <Ionicons
                name={isFocused ? icons.active : icons.inactive}
                size={20}
                color={isFocused ? "#0f282f" : "rgba(15,40,47,0.45)"}
              />
              <Text style={[s.label, isFocused && s.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "rgba(15,40,47,0.10)",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
  },
  label: {
    color: "rgba(15,40,47,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  labelActive: {
    color: "#0f282f",
    fontWeight: "800",
  },
});
