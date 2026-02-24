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
    paddingVertical: 12,
    marginBottom: 14,
    gap: 6,
  },
  balanceHeroLabel: { color: T.textDim, fontSize: 12, fontWeight: "800" },
  balanceHeroValue: { color: T.text, fontSize: 34, fontWeight: "900" },
  balanceHeroPctTxt: { fontSize: 12, fontWeight: "800" },
  balanceHeroPctTxtZero: { color: T.text },
  balanceHeroPctTxtPositive: { color: T.green },
  heroPayBtn: {
    marginTop: 48,
    width: "100%",
    backgroundColor: T.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  heroPayBtnSmall: { marginTop: 32 },
  heroPayBtnTxt: { color: T.onAccent, fontSize: 15, fontWeight: "800" },
});
