import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { analyticsStyles as s } from "@/screens/analytics/styles";
import type { AnalyticsTopTip } from "@/screens/analytics/types";

export default function AnalyticsTipsCard({ tips }: { tips: AnalyticsTopTip[] }) {
  return (
    <View style={s.tipCard}>
      <Text style={s.tipTitle}>Top Insights</Text>
      {tips.length === 0 ? (
        <Text style={s.tipText}>No insights yet.</Text>
      ) : (
        tips.map((tip, idx) => (
          <View key={`${tip.title}-${idx}`} style={[s.tipRow, idx > 0 && s.tipRowBorder]}>
            <Ionicons name="sparkles-outline" size={14} color={T.accent} />
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