"use client";

import { Target, Shield, PiggyBank, TrendingUp, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/money";

interface Goal {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  type: "yearly" | "long-term" | "long_term" | "short_term" | "short-term";
  category: "debt" | "savings" | "emergency" | "investment" | "other";
  targetYear?: number;
  description?: string;
}

interface GoalsDisplayProps {
  goals: Goal[];
}

function Currency({ value }: { value: number }) {
  return <span>{formatCurrency(value)}</span>;
}

export default function GoalsDisplay({ goals }: GoalsDisplayProps) {
  const currentYear = new Date().getFullYear();

  const normalizeType = (type: Goal["type"]) => {
    if (type === "long_term") return "long-term";
    if (type === "short_term") return "short-term";
    return type;
  };
  
  // Filter out "Pay Back Debts" goal from home display
  const displayGoals = goals.filter(g => g.title !== "Pay Back Debts");

  const normalizedGoals = displayGoals.map((g) => ({
    ...g,
    type: normalizeType(g.type),
  }));
  
  // Group goals by time horizon
  const yearlyGoals = normalizedGoals.filter(g => g.type === "yearly" || g.type === "short-term");
  const fiveYearGoals = normalizedGoals.filter(g => 
    g.type === "long-term" && g.targetYear && g.targetYear <= currentYear + 5
  );
  const tenYearGoals = normalizedGoals.filter(g => 
    g.type === "long-term" && g.targetYear && g.targetYear > currentYear + 5
  );

  const categoryIcons = {
    debt: TrendingUp,
    savings: PiggyBank,
    emergency: Shield,
    investment: Target,
    other: Target,
  };

  if (normalizedGoals.length === 0) return null;

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const Icon = categoryIcons[goal.category];
    const progress = goal.targetAmount && goal.currentAmount 
      ? (goal.currentAmount / goal.targetAmount) * 100 
      : 0;

    return (
      <div className="bg-[#9EDBFF] rounded-2xl p-5 shadow-xl border border-sky-200/70 hover:shadow-2xl transition-all">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-white/40 p-2.5 rounded-xl shadow-sm border border-black/5">
            <Icon size={20} className="text-slate-900" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900 text-base mb-1">{goal.title}</h4>
            {goal.targetYear && (
              <div className="flex items-center gap-1.5 text-slate-700 text-sm">
                <Calendar size={14} />
                <span>Target: {goal.targetYear}</span>
              </div>
            )}
            {goal.description && !goal.targetAmount && (
              <p className="text-sm text-slate-700 mt-2">{goal.description}</p>
            )}
          </div>
        </div>
        
        {goal.targetAmount && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-800 font-medium">
              <span><Currency value={goal.currentAmount || 0} /></span>
              <span><Currency value={goal.targetAmount} /></span>
            </div>
            <div className="w-full bg-slate-900/10 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-green-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="text-right text-sm text-slate-800 font-semibold">
              {progress.toFixed(1)}% Complete
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-white/10 p-2.5 rounded-xl shadow-md backdrop-blur-sm">
          <Target size={24} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">Financial Goals</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* This Year's Goals */}
        {yearlyGoals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 px-2">
              <span className="text-2xl">📅</span>
              <h3 className="font-bold text-lg text-white">This Year ({currentYear})</h3>
            </div>
            <div className="space-y-4">
              {yearlyGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>
        )}

        {/* 5-Year Goals */}
        {fiveYearGoals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 px-2">
              <span className="text-2xl">🎯</span>
              <h3 className="font-bold text-lg text-white">5-Year Goals</h3>
            </div>
            <div className="space-y-4">
              {fiveYearGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>
        )}

        {/* 10-Year Goals */}
        {tenYearGoals.length > 0 && (
          <>
            {tenYearGoals.map((goal) => (
              <div key={goal.id} className="space-y-4">
                <GoalCard goal={goal} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
