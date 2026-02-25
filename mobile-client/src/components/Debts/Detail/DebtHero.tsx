import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { T } from "@/lib/theme";

type Props = {
  currentBalanceLabel: string;
  currentBalanceValue: string;
  isPaid: boolean;
  progressPct: number;
  isVerySmallScreen: boolean;
  onRecordPayment: () => void;
};

export default function DebtHero({
  currentBalanceLabel,
  currentBalanceValue,
  isPaid,
  progressPct,
  isVerySmallScreen,
  onRecordPayment,
}: Props) {
  return (
    <View style={s.balanceHero}>
      <Text style={s.balanceHeroLabel}>{currentBalanceLabel}</Text>
      <Text style={[s.balanceHeroValue, isPaid && { color: T.green }]}>{currentBalanceValue}</Text>
      <Text style={[s.balanceHeroPctTxt, progressPct > 0 ? s.balanceHeroPctTxtPositive : s.balanceHeroPctTxtZero]}>
        {progressPct.toFixed(1)}% paid off
      </Text>
      {!isPaid ? (
        <Pressable style={[s.heroPayBtn, isVerySmallScreen && s.heroPayBtnSmall]} onPress={onRecordPayment}>
          <Text style={s.heroPayBtnTxt}>Record payment</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  balanceHero: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    marginTop: -14,
    marginHorizontal: -14,
    marginBottom: 14,
    gap: 6,
    backgroundColor: "#2a0a9e",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  balanceHeroLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  balanceHeroValue: { color: "#ffffff", fontSize: 40, fontWeight: "900", letterSpacing: -0.5 },
  balanceHeroPctTxt: { fontSize: 13, fontWeight: "800" },
  balanceHeroPctTxtZero: { color: "rgba(255,255,255,0.65)" },
  balanceHeroPctTxtPositive: { color: "#7fffc0" },
  heroPayBtn: {
    marginTop: 28,
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  heroPayBtnSmall: { marginTop: 18 },
  heroPayBtnTxt: { color: "#2a0a9e", fontSize: 15, fontWeight: "900" },
});
