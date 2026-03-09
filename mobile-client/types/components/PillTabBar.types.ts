export type GlassEffectModule = typeof import("expo-glass-effect");

export type PillTabBarIconName = import("react").ComponentProps<typeof import("@expo/vector-icons").Ionicons>["name"];

export type PillTabBarHomeIconProps = {
  color: string;
};