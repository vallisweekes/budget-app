import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/components/AnalyticsScreen/style";
import type { AnalyticsTopTip } from "@/types/AnalyticsScreen.types";

export default function AnalyticsTipsCard({ tips }: { tips: AnalyticsTopTip[] }) {
  return (
    <View style={s.tipCard}>
      <View style={[s.sectionGlow, s.tipsGlowPrimary]} />
      <View style={s.sectionHead}>
        <View>
          <Text style={s.sectionEyebrow}>Signals worth watching</Text>
          <Text style={s.tipTitle}>Top Insights</Text>
        </View>
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{tips.length} notes</Text>
        </View>
      </View>
      {tips.length === 0 ? (
        <Text style={s.tipText}>No insights yet.</Text>
      ) : (
        tips.map((tip, idx) => (
          <View key={`${tip.title}-${idx}`} style={[s.tipRow, idx > 0 && s.tipRowBorder]}>
            <View style={s.tipIconWrap}>
              <Ionicons name="sparkles-outline" size={14} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.tipTitleRow}>
                <Text style={s.tipRowTitle}>{tip.title}</Text>
                {Number(tip.priority ?? 0) >= 80 ? <Text style={s.priorityBadge}>High priority</Text> : null}
              </View>
              <Text style={s.tipText}>{tip.detail}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}