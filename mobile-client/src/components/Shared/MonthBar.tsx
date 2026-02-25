import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { T } from "@/lib/theme";

interface MonthBarProps {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  /** Disable the back arrow when at the earliest allowed month */
  prevDisabled?: boolean;
}

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export default function MonthBar({
  month,
  year,
  onPrev,
  onNext,
  prevDisabled = false,
}: MonthBarProps) {
  return (
		<BlurView intensity={22} tint="dark" style={s.glassBase}>
			<View style={s.glassTint} />
			<View style={s.bar}>
				<Text style={s.label}>
					{MONTH_NAMES[month - 1]} {year}
				</Text>

				<View style={s.actions}>
					<Pressable
						onPress={onPrev}
						disabled={prevDisabled}
						style={[s.arrow, prevDisabled && s.arrowDisabled]}
						hitSlop={8}
					>
						<Ionicons
							name="chevron-back"
							size={20}
							color={prevDisabled ? T.textMuted : T.text}
						/>
					</Pressable>
					<Pressable onPress={onNext} style={s.arrow} hitSlop={8}>
						<Ionicons name="chevron-forward" size={20} color={T.text} />
					</Pressable>
				</View>
			</View>
		</BlurView>
  );
}

const s = StyleSheet.create({
  glassBase: {
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: `${T.accent}29`,
    backgroundColor: `${T.card}A8`,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${T.accent}12`,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "transparent",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  arrowDisabled: { opacity: 0.4 },
  label: { color: T.text, fontSize: 16, fontWeight: "900" },
});
