"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import type { SpendingInsight, SpendingInsightIcon } from "@/lib/ai/spendingInsights";
import { getFallbackSpendingInsights } from "@/lib/helpers/spending/spendingFallbackInsights";

interface SpendingEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  source: "card" | "savings" | "allowance";
  sourceId?: string;
}

interface InsightsProps {
  spending: SpendingEntry[];
  previousMonthSpending?: SpendingEntry[];
  currentMonthLabel?: string;
  previousMonthLabel?: string;
  allowanceStats: {
    monthlyAllowance: number;
    totalUsed: number;
    remaining: number;
    percentUsed: number;
  };
  savingsBalance: number;
}

export default function SpendingInsights({ spending, previousMonthSpending, currentMonthLabel, previousMonthLabel, allowanceStats, savingsBalance }: InsightsProps) {
  const [expandedInsight, setExpandedInsight] = useState<number | null>(0);
	const [aiInsights, setAiInsights] = useState<SpendingInsight[] | null>(null);

	const fallbackInsights = useMemo(
		() => getFallbackSpendingInsights({ spending, allowanceStats, savingsBalance }),
		[spending, allowanceStats, savingsBalance]
	);
  const insights = aiInsights && aiInsights.length ? aiInsights : fallbackInsights;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/insights/spending", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spending, previousMonthSpending: previousMonthSpending ?? [], currentMonthLabel, previousMonthLabel, allowanceStats, savingsBalance }),
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { insights?: SpendingInsight[] } | null;
        const next = Array.isArray(data?.insights) ? data!.insights : [];
        if (!cancelled) setAiInsights(next);
      } catch {
        // Best-effort: keep deterministic fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spending, previousMonthSpending, currentMonthLabel, previousMonthLabel, allowanceStats, savingsBalance]);

  const colorClasses = {
    red: "border-red-500/50 bg-red-500/10",
    orange: "border-orange-500/50 bg-orange-500/10",
    amber: "border-amber-500/50 bg-amber-500/10",
    blue: "border-blue-500/50 bg-blue-500/10",
    emerald: "border-emerald-500/50 bg-emerald-500/10",
    purple: "border-purple-500/50 bg-purple-500/10"
  };

  const iconColorClasses = {
    red: "text-red-400",
    orange: "text-orange-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    purple: "text-purple-400"
  };

	const iconByKey: Record<SpendingInsightIcon, LucideIcon> = {
		alert: AlertTriangle,
		lightbulb: Lightbulb,
		trendUp: TrendingUp,
		trendDown: TrendingDown,
	};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="text-purple-400" size={24} />
        <h2 className="text-xl font-semibold text-white">AI Spending Insights</h2>
      </div>

      {insights.map((insight, idx) => {
        const Icon = iconByKey[insight.icon];
        const isExpanded = expandedInsight === idx;
        
        return (
          <div
            key={idx}
            className={`border rounded-xl overflow-hidden transition-all ${colorClasses[insight.color]}`}
          >
            <button
              onClick={() => setExpandedInsight(isExpanded ? null : idx)}
              className="w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors"
            >
              <Icon className={`flex-shrink-0 mt-1 ${iconColorClasses[insight.color]}`} size={20} />
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-white mb-1">{insight.title}</h3>
                <p className="text-sm text-slate-300">{insight.message}</p>
              </div>
              {isExpanded ? (
                <ChevronUp className="text-slate-400 flex-shrink-0" size={20} />
              ) : (
                <ChevronDown className="text-slate-400 flex-shrink-0" size={20} />
              )}
            </button>
            
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-white/10">
                <p className="text-sm text-slate-400 mb-2 font-medium">💡 Recommendation:</p>
                <p className="text-sm text-slate-300">{insight.recommendation}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
