import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getApiBaseUrl } from "@/lib/api";
import { T } from "@/lib/theme";

function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  try {
    return `${getApiBaseUrl()}${raw}`;
  } catch {
    return null;
  }
}

type Props = {
  debtName: string;
  logoUrl?: string | null;
  currentBalanceLabel: string;
  currentBalanceValue: string;
  isPaid: boolean;
  progressPct: number;
  isVerySmallScreen: boolean;
  onRecordPayment: () => void;
};

export default function DebtHero({
  debtName,
  logoUrl,
  currentBalanceLabel,
  currentBalanceValue,
  isPaid,
  progressPct,
  isVerySmallScreen,
  onRecordPayment,
}: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUri = useMemo(() => resolveLogoUri(logoUrl), [logoUrl]);
  const showLogo = Boolean(logoUri) && !logoFailed;

  return (
    <View style={s.balanceHero}>
      <View style={s.brandCircle}>
        {showLogo ? (
          <Image
            source={{ uri: logoUri as string }}
            style={s.brandLogo}
            resizeMode="contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Text style={s.brandLetter}>{(debtName?.trim()?.[0] ?? "?").toUpperCase()}</Text>
        )}
      </View>
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
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
    marginTop: 0,
    marginHorizontal: -14,
    marginBottom: 0,
    gap: 6,
    backgroundColor: "#2a0a9e",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  brandCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  brandLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  brandLetter: {
    color: "#2a0a9e",
    fontSize: 18,
    fontWeight: "900",
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
