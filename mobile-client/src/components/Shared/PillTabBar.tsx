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
import Svg, { Path } from "react-native-svg";

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        d="M 23.951172 4 A 1.50015 1.50015 0 0 0 23.072266 4.3222656 L 8.859375 15.519531 C 7.0554772 16.941163 6 19.113506 6 21.410156 L 6 40.5 C 6 41.863594 7.1364058 43 8.5 43 L 18.5 43 C 19.863594 43 21 41.863594 21 40.5 L 21 30.5 C 21 30.204955 21.204955 30 21.5 30 L 26.5 30 C 26.795045 30 27 30.204955 27 30.5 L 27 40.5 C 27 41.863594 28.136406 43 29.5 43 L 39.5 43 C 40.863594 43 42 41.863594 42 40.5 L 42 21.410156 C 42 19.113506 40.944523 16.941163 39.140625 15.519531 L 24.927734 4.3222656 A 1.50015 1.50015 0 0 0 23.951172 4 z M 24 7.4101562 L 37.285156 17.876953 C 38.369258 18.731322 39 20.030807 39 21.410156 L 39 40 L 30 40 L 30 30.5 C 30 28.585045 28.414955 27 26.5 27 L 21.5 27 C 19.585045 27 18 28.585045 18 30.5 L 18 40 L 9 40 L 9 21.410156 C 9 20.030807 9.6307412 18.731322 10.714844 17.876953 L 24 7.4101562 z"
        fill={color}
      />
    </Svg>
  );
}

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
                    {route.name === "Dashboard" ? (
                      <HomeIcon color={isFocused ? T.text : T.textDim} />
                    ) : (
                      <Ionicons
                        name={isFocused ? icons.active : icons.inactive}
                        size={20}
                        color={isFocused ? T.text : T.textDim}
                      />
                    )}
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
