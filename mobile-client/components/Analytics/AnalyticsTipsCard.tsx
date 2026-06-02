import React from "react";

import DashboardAiTipsCard from "@/components/DashboardScreen/DashboardAiTipsCard";
import type { AnalyticsTopTip } from "@/types/AnalyticsScreen.types";

export default function AnalyticsTipsCard({ tips }: { tips: AnalyticsTopTip[] }) {
  const normalizedTips = React.useMemo(
    () => tips.map((tip) => ({
      title: String(tip?.title ?? ""),
      detail: String(tip?.detail ?? ""),
      priority: Number(tip?.priority ?? 0),
    })),
    [tips],
  );

  return <DashboardAiTipsCard tips={normalizedTips} />;
}