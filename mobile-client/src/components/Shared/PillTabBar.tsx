import React from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
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
    <View style={{ height: 0 }}>
      <View style={[s.wrapper, { paddingBottom: (insets.bottom || 16) + 4 }]}>
        {/* Outer glow ring — sits behind the pill */}
        <View pointerEvents="none" style={s.outerGlow} />

        {/* The pill itself — ultra-thin blur so content behind is clearly visible */}
        <BlurView
          intensity={55}
          tint="systemUltraThinMaterialDark"
          style={s.bar}
        >

          {/* Bottom refraction edge */}
          <View pointerEvents="none" style={s.specularBottom} />

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
                android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: true, radius: 32 }}
              >
                {isFocused ? (
                  // Active bubble — glass lens within glass
                  <View style={s.activePill}>
                    <Ionicons name={icons.active} size={19} color="#fff" />
                    <Text style={s.activePillLabel} numberOfLines={1}>{label}</Text>
                  </View>
                ) : (
                  <>
                    <View style={s.iconWrap}>
                      <Ionicons name={icons.inactive} size={19} color="rgba(255,255,255,0.5)" />
                    </View>
                    <Text style={s.label} numberOfLines={1}>{label}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </BlurView>
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
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "transparent",
  },

  // Soft ambient glow behind the pill — makes it look like it's lit from inside
  outerGlow: {
    position: "absolute",
    bottom: 0,
    left: 14,
    right: 14,
    top: 10,
    borderRadius: 36,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(2,239,240,0.45)",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 28,
      },
    }),
  },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.5,
        shadowRadius: 28,
      },
      android: {
        elevation: 20,
        backgroundColor: "rgba(6,22,26,0.85)",
      },
    }),
  },

  specularBottom: {
    position: "absolute",
    bottom: 0,
    left: 30,
    right: 30,
    height: 1,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 1,
  },

  // Active glass bubble — a second glass surface sitting inside the first
  activePill: {
    width: "100%",
    minHeight: 46,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },

  activePillLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  iconWrap: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
