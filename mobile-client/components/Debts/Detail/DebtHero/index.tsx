import React, { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import type { DebtHeroProps } from "@/types";
import { getApiBaseUrl } from "@/lib/api";
import { T } from "@/lib/theme";
import { styles } from "./styles";

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

export default function DebtHero({
  debtName,
  logoUrl,
  currentBalanceLabel,
  currentBalanceValue,
  isPaid,
  progressPct,
  isVerySmallScreen,
  topInset = 0,
  onRecordPayment,
}: DebtHeroProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUri = useMemo(() => resolveLogoUri(logoUrl), [logoUrl]);
  const showLogo = Boolean(logoUri) && !logoFailed;

  return (
    <View style={[styles.balanceHero, { paddingTop: styles.balanceHero.paddingTop + topInset }]}>
      <View style={styles.brandCircle}>
        {showLogo ? (
          <Image
            source={{ uri: logoUri as string }}
            style={styles.brandLogo}
            resizeMode="contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Text style={styles.brandLetter}>{(debtName?.trim()?.[0] ?? "?").toUpperCase()}</Text>
        )}
      </View>
      <Text style={styles.balanceHeroLabel}>{currentBalanceLabel}</Text>
      <Text style={[styles.balanceHeroValue, isPaid && { color: T.green }]}>{currentBalanceValue}</Text>
      <Text style={[styles.balanceHeroPctTxt, progressPct > 0 ? styles.balanceHeroPctTxtPositive : styles.balanceHeroPctTxtZero]}>
        {progressPct.toFixed(1)}% paid off
      </Text>
      {!isPaid ? (
        <Pressable style={[styles.heroPayBtn, isVerySmallScreen && styles.heroPayBtnSmall]} onPress={onRecordPayment}>
          <Text style={styles.heroPayBtnTxt}>Record payment</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
