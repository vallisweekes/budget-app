import React, { useMemo, useState } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { T } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  Dashboard: { active: "home", inactive: "home-outline" },
  Expenses:  { active: "receipt", inactive: "receipt-outline" },
  Debts:     { active: "card", inactive: "card-outline" },
  Goals:     { active: "flag", inactive: "flag-outline" },
};

const LABELS: Record<string, string> = {
  Dashboard: "Home",
  Expenses:  "Expenses",
  Debts:     "Debts",
  Goals:     "Goals",
};

const INDICATOR_SIZE = 46;
const BAR_HORIZONTAL_PADDING = 8;
const INDICATOR_VERTICAL_OFFSET = -2;

export default function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const activeRouteName = state.routes[state.index]?.name;

  const visibleRoutes = state.routes.filter((r) => {
    const opts = descriptors[r.key].options as Record<string, unknown>;
    return opts.tabBarButton == null;
  });

  const activeVisibleIndex = useMemo(() => {
    const activeName = state.routes[state.index]?.name;
    const idx = visibleRoutes.findIndex((route) => route.name === activeName);
    return idx >= 0 ? idx : 0;
  }, [state.index, state.routes, visibleRoutes]);

  if (activeRouteName === "Settings") {
    return null;
  }

  const innerWidth = Math.max(0, barWidth - BAR_HORIZONTAL_PADDING * 2);
  const slotWidth = innerWidth > 0 && visibleRoutes.length > 0 ? innerWidth / visibleRoutes.length : 0;
  const indicatorLeft = slotWidth > 0
    ? BAR_HORIZONTAL_PADDING + activeVisibleIndex * slotWidth + (slotWidth - INDICATOR_SIZE) / 2
    : 0;
  const indicatorTop = barHeight > 0 ? (barHeight - INDICATOR_SIZE) / 2 + INDICATOR_VERTICAL_OFFSET : 4;

  return (
    <View style={s.wrapper}>
      <BlurView intensity={22} tint="dark" style={s.glassBase}>
        <View style={s.glassTint} />
        <View
          style={s.bar}
          onLayout={(event) => {
            setBarWidth(event.nativeEvent.layout.width);
            setBarHeight(event.nativeEvent.layout.height);
          }}
        >
          {slotWidth > 0 ? (
            <View
              pointerEvents="none"
              style={[
                s.liquidIndicator,
                {
                  left: indicatorLeft,
                  top: indicatorTop,
                },
              ]}
            >
              <View style={s.liquidInner} />
            </View>
          ) : null}
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
              if (!event.defaultPrevented) {
                if (route.name === "Expenses") {
                  navigation.navigate("Expenses", { screen: "ExpensesList" });
                } else if (route.name === "Debts") {
                  navigation.navigate("Debts", { screen: "DebtList" });
                } else if (route.name === "Dashboard") {
                  navigation.navigate("Dashboard");
                } else if (route.name === "Goals") {
                  navigation.navigate("Goals");
                }
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={s.tab}
                android_ripple={{ color: T.border, borderless: false }}
              >
                <View style={[s.tabContent, isFocused && s.tabContentActive]}>
                  <View style={s.iconWrap}>
                    <Ionicons
                      name={isFocused ? icons.active : icons.inactive}
                      size={20}
                      color={isFocused ? T.text : T.textDim}
                    />
                  </View>
                  {!isFocused ? (
                    <Text style={s.label} numberOfLines={1}>
                      {label}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  glassBase: {
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: `${T.accent}29`,
    backgroundColor: `${T.card}A8`,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${T.accent}12`,
  },
  bar: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
  },
  liquidIndicator: {
    position: "absolute",
    overflow: "hidden",
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: `${T.accent}30`,
    borderWidth: 1,
    borderColor: `${T.accent}73`,
    shadowColor: T.accent,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 7,
  },
  liquidInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 1,
    borderColor: `${T.text}14`,
    backgroundColor: `${T.text}08`,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    borderRadius: 12,
    zIndex: 1,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: INDICATOR_SIZE,
  },
  tabContentActive: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    transform: [{ translateY: INDICATOR_VERTICAL_OFFSET }],
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
