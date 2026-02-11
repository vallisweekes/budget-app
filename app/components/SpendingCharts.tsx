"use client";

interface SpendingEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  source: "card" | "savings" | "allowance";
  sourceId?: string;
}

interface SpendingChartsProps {
  spending: SpendingEntry[];
}

export default function SpendingCharts({ spending }: SpendingChartsProps) {
  // Calculate spending by source
  const bySource = spending.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + s.amount;
    return acc;
  }, {} as Record<string, number>);

  const total = spending.reduce((sum, s) => sum + s.amount, 0);

  const sourceData = [
    { label: "Allowance", value: bySource.allowance || 0, color: "from-emerald-400 to-emerald-600" },
    { label: "Card", value: bySource.card || 0, color: "from-orange-400 to-orange-600" },
    { label: "Savings", value: bySource.savings || 0, color: "from-purple-400 to-purple-600" },
  ].filter(d => d.value > 0);

  // Group spending by day for trend
  const byDay = spending.reduce((acc, s) => {
    const date = new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    acc[date] = (acc[date] || 0) + s.amount;
    return acc;
  }, {} as Record<string, number>);

  const trendData = Object.entries(byDay)
    .sort(([a], [b]) => {
      const [dayA, monthA] = a.split('/').map(Number);
      const [dayB, monthB] = b.split('/').map(Number);
      return monthA === monthB ? dayA - dayB : monthA - monthB;
    })
    .map(([date, amount]) => ({ label: date, value: amount }));

  const maxTrend = Math.max(...trendData.map(d => d.value), 1);

  if (spending.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-2xl p-8 shadow-xl border border-white/10 text-center">
        <p className="text-slate-400">No spending data to display charts yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Spending by Source - Pie Chart Style */}
      <div className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Spending by Source</h3>
        <div className="space-y-3">
          {sourceData.map((source) => {
            const percentage = (source.value / total) * 100;
            return (
              <div key={source.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">{source.label}</span>
                  <span className="text-sm font-semibold text-white">
                    £{source.value.toFixed(2)} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900/60 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${source.color} transition-all duration-500 rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Total Spent</span>
            <span className="text-xl font-bold text-white">£{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Daily Spending Trend */}
      <div className="bg-slate-800/40 rounded-2xl p-6 shadow-xl border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Spending Trend</h3>
        <div className="flex items-end gap-2 h-32 px-2">
          {trendData.map((d, idx) => {
            const height = (d.value / maxTrend) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 transition-all cursor-pointer"
                  style={{ height: `${height}%` }}
                  title={`£${d.value.toFixed(2)}`}
                />
                <div className="text-[10px] text-slate-500 rotate-45 origin-left whitespace-nowrap">
                  {d.label}
                </div>
                {/* Tooltip on hover */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 pointer-events-none">
                  £{d.value.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
        {trendData.length === 0 && (
          <p className="text-center text-slate-400 text-sm">No daily data available yet</p>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 rounded-xl p-4 shadow-xl border border-white/10">
          <div className="text-sm text-slate-400 mb-1">Total Transactions</div>
          <div className="text-2xl font-bold text-white">{spending.length}</div>
        </div>
        <div className="bg-slate-800/40 rounded-xl p-4 shadow-xl border border-white/10">
          <div className="text-sm text-slate-400 mb-1">Avg per Transaction</div>
          <div className="text-2xl font-bold text-white">
            £{(total / (spending.length || 1)).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
