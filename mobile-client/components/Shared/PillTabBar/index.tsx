import React, { useMemo, useState } from "react";
import { View, Pressable, Text, Platform } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { T } from "@/lib/theme";
import Svg, { Path } from "react-native-svg";
import { styles } from "./styles";
import type { GlassEffectModule, PillTabBarHomeIconProps, PillTabBarIconName } from "@/types";

function HomeIcon({ color }: PillTabBarHomeIconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        d="M 23.951172 4 A 1.50015 1.50015 0 0 0 23.072266 4.3222656 L 8.859375 15.519531 C 7.0554772 16.941163 6 19.113506 6 21.410156 L 6 40.5 C 6 41.863594 7.1364058 43 8.5 43 L 18.5 43 C 19.863594 43 21 41.863594 21 40.5 L 21 30.5 C 21 30.204955 21.204955 30 21.5 30 L 26.5 30 C 26.795045 30 27 30.204955 27 30.5 L 27 40.5 C 27 41.863594 28.136406 43 29.5 43 L 39.5 43 C 40.863594 43 42 41.863594 42 40.5 L 42 21.410156 C 42 19.113506 40.944523 16.941163 39.140625 15.519531 L 24.927734 4.3222656 A 1.50015 1.50015 0 0 0 23.951172 4 z M 24 7.4101562 L 37.285156 17.876953 C 38.369258 18.731322 39 20.030807 39 21.410156 L 39 40 L 30 40 L 30 30.5 C 30 28.585045 28.414955 27 26.5 27 L 21.5 27 C 19.585045 27 18 28.585045 18 30.5 L 18 40 L 9 40 L 9 21.410156 C 9 20.030807 9.6307412 18.731322 10.714844 17.876953 L 24 7.4101562 z"
        fill={color}
      />
    </Svg>
  );
}

const ICONS: Record<string, { active: PillTabBarIconName; inactive: PillTabBarIconName }> = {
  dashboard: { active: "home", inactive: "home-outline" },
  expenses:  { active: "receipt", inactive: "receipt-outline" },
  debts:     { active: "card", inactive: "card-outline" },
  goals:     { active: "ellipse", inactive: "ellipse-outline" },
  income:    { active: "wallet", inactive: "wallet-outline" },
};

const LABELS: Record<string, string> = {
  dashboard: "Home",
  expenses:  "Expenses",
  debts:     "Debts",
  goals:     "Goals",
  income:    "Income",
};

const PRIMARY_TABS = ["dashboard", "expenses", "debts", "income", "goals"] as const;

const INDICATOR_SIZE = 46;
const BAR_HORIZONTAL_PADDING = 8;
const INDICATOR_VERTICAL_OFFSET = -2;

function getRouteBaseName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.split("/")[0] ?? "";
}

function getDeepestRouteName(state: unknown): string | null {
  let current = state as { routes?: Array<{ name?: string; state?: unknown }>; index?: number } | undefined;
  while (current?.routes && current.routes.length > 0) {
    const idx = typeof current.index === "number" ? current.index : current.routes.length - 1;
    const route = current.routes[idx];
    if (!route) return null;
    if (!route.state) return typeof route.name === "string" ? route.name : null;
    current = route.state as { routes?: Array<{ name?: string; state?: unknown }>; index?: number };
  }
  return null;
}

export default function PillTabBar({ state, descriptors: _descriptors, navigation }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const activeRouteName = getRouteBaseName(state.routes[state.index]?.name);
  const deepestRouteName = getDeepestRouteName(state.routes[state.index]?.state);
  const glassEffectModule = useMemo<GlassEffectModule | null>(() => {
    if (Platform.OS !== "ios") return null;
    try {
      return require("expo-glass-effect") as GlassEffectModule;
    } catch {
      return null;
    }
  }, []);
  const liquidGlassEnabled = useMemo(() => {
    if (!glassEffectModule) return false;
    try {
      return glassEffectModule.isLiquidGlassAvailable();
    } catch {
      return false;
    }
  }, [glassEffectModule]);
  const GlassView = glassEffectModule?.GlassView;

  const visibleRoutes = useMemo(() => {
    const allowed = new Set<string>(PRIMARY_TABS);
    const preferredOrder = new Map<string, number>(PRIMARY_TABS.map((name, index) => [name, index]));
    const seen = new Set<string>();

    return state.routes
      .filter((route) => {
        const baseName = getRouteBaseName(route.name);
        if (!allowed.has(baseName) || seen.has(baseName)) return false;
        seen.add(baseName);
        return true;
      })
      .sort((left, right) => {
        const leftName = getRouteBaseName(left.name);
        const rightName = getRouteBaseName(right.name);
        return (preferredOrder.get(leftName) ?? Number.MAX_SAFE_INTEGER) - (preferredOrder.get(rightName) ?? Number.MAX_SAFE_INTEGER);
      });
  }, [state.routes]);

  const activeVisibleIndex = useMemo(() => {
    const activeName = getRouteBaseName(state.routes[state.index]?.name);
    const idx = visibleRoutes.findIndex((route) => getRouteBaseName(route.name) === activeName);
    return idx >= 0 ? idx : -1;
  }, [state.index, state.routes, visibleRoutes]);

  if (
    activeRouteName === "settings"
    || deepestRouteName === "DebtDetail"
    || deepestRouteName === "ExpenseDetail"
    || deepestRouteName === "CategoryExpenses"
  ) {
    return null;
  }

  const innerWidth = Math.max(0, barWidth - BAR_HORIZONTAL_PADDING * 2);
  const slotWidth = innerWidth > 0 && visibleRoutes.length > 0 ? innerWidth / visibleRoutes.length : 0;
  const indicatorLeft = slotWidth > 0 && activeVisibleIndex >= 0
    ? BAR_HORIZONTAL_PADDING + activeVisibleIndex * slotWidth + (slotWidth - INDICATOR_SIZE) / 2
    : 0;
  const indicatorTop = barHeight > 0 ? (barHeight - INDICATOR_SIZE) / 2 + INDICATOR_VERTICAL_OFFSET : 4;

  return (
    <View style={styles.wrapper}>
      <BlurView intensity={30} tint="dark" style={styles.glassBase}>
        <View style={styles.glassTint} />
        <View
          style={styles.bar}
          onLayout={(event) => {
            setBarWidth(event.nativeEvent.layout.width);
            setBarHeight(event.nativeEvent.layout.height);
          }}
        >
          {slotWidth > 0 && activeVisibleIndex >= 0 ? (
            <View
              pointerEvents="none"
              style={[
                styles.liquidIndicator,
                {
                  left: indicatorLeft,
                  top: indicatorTop,
                },
              ]}
            >
              {liquidGlassEnabled && GlassView ? (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  tintColor="rgba(255,255,255,0)"
                  style={styles.liquidIndicatorGlass}
                />
              ) : null}
              <View style={styles.liquidInner} />
            </View>
          ) : null}
          {visibleRoutes.map((route) => {
            const baseName = getRouteBaseName(route.name);
            const isFocused = getRouteBaseName(state.routes[state.index].name) === baseName;
            const icons = ICONS[baseName] ?? { active: "ellipse", inactive: "ellipse-outline" };
            const label = LABELS[baseName] ?? baseName;

            const onPress = () => {
              const focused = isFocused;
              const nestedRouteName = getDeepestRouteName(route.state);
              const isNestedExpenses = baseName === "expenses" && focused && nestedRouteName !== "ExpensesList";
              const isNestedDebts = baseName === "debts" && focused && nestedRouteName !== "DebtList";

              if (isNestedExpenses) {
                navigation.navigate(route.name, { screen: "ExpensesList" });
                return;
              }

              if (isNestedDebts) {
                navigation.navigate(route.name, { screen: "DebtList" });
                return;
              }

              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;

              if (!focused) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tab}
                android_ripple={{ color: T.border, borderless: false }}
              >
                <View style={[styles.tabContent, isFocused && styles.tabContentActive]}>
                  <View style={styles.iconWrap}>
                    {baseName === "dashboard" ? (
                      <HomeIcon color={isFocused ? T.text : T.textDim} />
                    ) : baseName === "goals" ? (
                      <Octicons
                        name="goal"
                        size={20}
                        color={isFocused ? T.text : T.textDim}
                      />
                    ) : (
                      <Ionicons
                        name={isFocused ? icons.active : icons.inactive}
                        size={20}
                        color={isFocused ? T.text : T.textDim}
                      />
                    )}
                  </View>
                  {!isFocused ? (
                    <Text style={styles.label} numberOfLines={1}>
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
