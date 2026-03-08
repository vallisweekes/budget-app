import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { T } from "@/lib/theme";
import { styles } from "@/screens/dashboard/styles";

type DashboardTip = { title: string; detail: string; priority?: number };

export default function DashboardAiTipsCard({ tips }: { tips: DashboardTip[] }) {
  const validTips = useMemo(
    () => tips.filter((tip) => String(tip?.title ?? "").trim() && String(tip?.detail ?? "").trim()),
    [tips]
  );
  const [activeTipIndex, setActiveTipIndex] = useState(0);

  useEffect(() => {
    setActiveTipIndex(0);
  }, [validTips]);

  useFocusEffect(
    useCallback(() => {
      if (validTips.length <= 1) return undefined;

      const timer = setInterval(() => {
        setActiveTipIndex((current) => (current + 1) % validTips.length);
      }, 20000);

      return () => clearInterval(timer);
    }, [validTips.length])
  );

  const activeTip = validTips.length ? validTips[activeTipIndex % validTips.length] : null;
  if (!activeTip) return null;

  return (
    <View style={styles.aiTipsCard}>
      <View style={styles.aiTipsHeader}>
        <View style={styles.aiTipsTitleWrap}>
          <View style={styles.aiTipsIconWrap}>
            <Ionicons name="bulb-outline" size={16} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTipsTitle}>AI Tips</Text>
          </View>
        </View>
      </View>

      <View style={styles.aiTipsBody}>
        <View style={styles.aiTipsMetaRow}>
          <Text style={styles.aiTipHeadline}>{activeTip.title}</Text>
          {Number(activeTip.priority ?? 0) >= 80 ? <Text style={styles.aiTipPriority}>High priority</Text> : null}
        </View>
        <Text style={styles.aiTipDetail}>{activeTip.detail}</Text>
      </View>

      {validTips.length > 1 ? (
        <View style={styles.aiTipsDots}>
          {validTips.map((tip, index) => (
            <View
              key={`${tip.title}-${index}`}
              style={[styles.aiTipsDot, index === activeTipIndex ? styles.aiTipsDotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}