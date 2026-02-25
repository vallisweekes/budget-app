"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

import type { SpendingInsight, SpendingInsightColor, SpendingInsightIcon } from "@/lib/ai/spendingInsights";

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

  // Analyze spending patterns
  const analyzeSpending = () => {
    const insights = [];
    
    // Calculate spending by source
    const bySource = spending.reduce((acc, s) => {
      acc[s.source] = (acc[s.source] || 0) + s.amount;
      return acc;
    }, {} as Record<string, number>);

    const totalSpent = spending.reduce((sum, s) => sum + s.amount, 0);
    const avgTransaction = totalSpent / (spending.length || 1);

    // Insight 1: Allowance usage
    if (allowanceStats.percentUsed > 80) {
      insights.push({
        type: "warning",
        title: allowanceStats.percentUsed >= 100 ? "Allowance Exceeded!" : "High Allowance Usage",
        message: `You've used ${allowanceStats.percentUsed.toFixed(0)}% of your monthly allowance (£${allowanceStats.totalUsed.toFixed(2)} of £${allowanceStats.monthlyAllowance.toFixed(2)}).`,
        recommendation: allowanceStats.percentUsed >= 100 
          ? "You've exceeded your budget. Consider using savings for essential purchases only."
          : "You're approaching your limit. Try to reduce discretionary spending for the rest of the period.",
        icon: AlertTriangle,
        color: "red"
      });
    } else if (allowanceStats.percentUsed > 50) {
      insights.push({
        type: "info",
        title: "Moderate Allowance Usage",
        message: `You've used ${allowanceStats.percentUsed.toFixed(0)}% of your monthly allowance. You're on track!`,
        recommendation: "Keep monitoring your spending to stay within budget.",
        icon: Lightbulb,
        color: "blue"
      });
    } else {
      insights.push({
        type: "success",
        title: "Great Budget Management!",
        message: `You've only used ${allowanceStats.percentUsed.toFixed(0)}% of your allowance. Well done!`,
        recommendation: "You're managing your budget excellently. Keep up the good work!",
        icon: TrendingDown,
        color: "emerald"
      });
    }

    // Insight 2: Source breakdown
    const primarySource = Object.entries(bySource).sort(([,a], [,b]) => b - a)[0];
    if (primarySource) {
      const [source, amount] = primarySource;
      const percentage = (amount / totalSpent) * 100;
      
      let sourceMessage = "";
      let sourceRecommendation = "";
      
      if (source === "card" && percentage > 60) {
        sourceMessage = `${percentage.toFixed(0)}% of your spending (£${amount.toFixed(2)}) is on credit cards.`;
        sourceRecommendation = "High card usage increases debt. Try using allowance or savings for planned purchases.";
      } else if (source === "savings" && amount > savingsBalance * 0.2) {
        sourceMessage = `You've spent £${amount.toFixed(2)} from savings, which is ${((amount/savingsBalance)*100).toFixed(0)}% of your total savings.`;
        sourceRecommendation = "Be cautious with savings spending. Reserve savings for emergencies or major purchases.";
      } else if (source === "allowance") {
        sourceMessage = `Great! ${percentage.toFixed(0)}% of spending is from your allowance (£${amount.toFixed(2)}).`;
        sourceRecommendation = "Using your allowance is the best approach. This keeps you within your monthly budget.";
      }

      insights.push({
        type: source === "allowance" ? "success" : "info",
        title: "Spending Source Analysis",
        message: sourceMessage,
        recommendation: sourceRecommendation,
        icon: source === "allowance" ? TrendingDown : TrendingUp,
        color: source === "allowance" ? "emerald" : source === "card" ? "orange" : "purple"
      });
    }

    // Insight 3: Transaction patterns
    if (spending.length > 0) {
      const sortedByAmount = [...spending].sort((a, b) => b.amount - a.amount);
      const largestTransaction = sortedByAmount[0];
      
      if (largestTransaction.amount > avgTransaction * 2) {
        insights.push({
          type: "info",
          title: "Large Purchase Detected",
          message: `Your largest purchase was "${largestTransaction.description}" for £${largestTransaction.amount.toFixed(2)}.`,
          recommendation: "Consider planning large purchases in advance to better manage your budget.",
          icon: AlertTriangle,
          color: "amber"
        });
      }

      // Frequency insight
      insights.push({
        type: "info",
        title: "Spending Frequency",
        message: `You've made ${spending.length} unplanned purchases with an average of £${avgTransaction.toFixed(2)} per transaction.`,
        recommendation: spending.length > 10 
          ? "You're making frequent small purchases. Try batching purchases to reduce impulse spending."
          : "You're keeping unplanned purchases under control. Great discipline!",
        icon: Lightbulb,
        color: "blue"
      });
    }

    return insights;
  };

  const fallbackInsights = useMemo(() => analyzeSpending(), [spending, allowanceStats, savingsBalance]);
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

	const iconByKey: Record<SpendingInsightIcon, any> = {
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
    const iconValue = (insight as any).icon;
    const Icon =
      typeof iconValue === "string" && (iconByKey as any)[iconValue]
        ? (iconByKey as any)[iconValue]
        : iconValue;
        const isExpanded = expandedInsight === idx;
        
        return (
          <div
            key={idx}
            className={`border rounded-xl overflow-hidden transition-all ${colorClasses[(insight as any).color as SpendingInsightColor]}`}
          >
            <button
              onClick={() => setExpandedInsight(isExpanded ? null : idx)}
              className="w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors"
            >
              <Icon className={`flex-shrink-0 mt-1 ${iconColorClasses[(insight as any).color as SpendingInsightColor]}`} size={20} />
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
