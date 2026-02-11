"use client";

import { Target, Shield, PiggyBank, TrendingUp, Calendar } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  targetAmount?: number;
  currentAmount?: number;
  type: "yearly" | "long-term";
  category: "debt" | "savings" | "emergency" | "investment" | "other";
  targetYear?: number;
  description?: string;
}

interface GoalsDisplayProps {
  goals: Goal[];
}

function Currency({ value }: { value: number }) {
  return <span>{value.toLocaleString(undefined, { style: "currency", currency: "GBP" })}</span>;
}

export default function GoalsDisplay({ goals }: GoalsDisplayProps) {
  const currentYear = new Date().getFullYear();
  
  // Filter out "Pay Back Debts" goal from home display
  const displayGoals = goals.filter(g => g.title !== "Pay Back Debts");
  
  // Group goals by time horizon
  const yearlyGoals = displayGoals.filter(g => g.type === "yearly");
  const fiveYearGoals = displayGoals.filter(g => 
    g.type === "long-term" && g.targetYear && g.targetYear <= currentYear + 5
  );
  const tenYearGoals = displayGoals.filter(g => 
    g.type === "long-term" && g.targetYear && g.targetYear > currentYear + 5
  );

  const categoryIcons = {
    debt: TrendingUp,
    savings: PiggyBank,
    emergency: Shield,
    investment: Target,
    other: Target,
  };

  if (displayGoals.length === 0) return null;

  const GoalCard = ({ goal, gradientClass }: { goal: Goal; gradientClass: string }) => {
    const Icon = categoryIcons[goal.category];
    const progress = goal.targetAmount && goal.currentAmount 
      ? (goal.currentAmount / goal.targetAmount) * 100 
      : 0;

    return (
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 shadow-xl border border-white/10 hover:border-white/20 hover:shadow-2xl transition-all">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-white/10 p-2.5 rounded-xl shadow-sm backdrop-blur-sm">
            <Icon size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white text-base mb-1">{goal.title}</h4>
            {goal.targetYear && (
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Calendar size={14} />
                <span>Target: {goal.targetYear}</span>
              </div>
            )}
            {goal.description && !goal.targetAmount && (
              <p className="text-sm text-slate-400 mt-2">{goal.description}</p>
            )}
          </div>
        </div>
        
        {goal.targetAmount && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-300 font-medium">
              <span><Currency value={goal.currentAmount || 0} /></span>
              <span><Currency value={goal.targetAmount} /></span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-green-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="text-right text-sm text-slate-300 font-semibold">
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
                <GoalCard key={goal.id} goal={goal} gradientClass="from-purple-500 via-purple-600 to-indigo-600" />
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
                <GoalCard key={goal.id} goal={goal} gradientClass="from-emerald-500 via-emerald-600 to-green-600" />
              ))}
            </div>
          </div>
        )}

        {/* 10-Year Goals */}
        {tenYearGoals.length > 0 && (
          <>
            {tenYearGoals.map((goal) => (
              <div key={goal.id} className="space-y-4">
                <GoalCard goal={goal} gradientClass="from-blue-500 via-blue-600 to-cyan-600" />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
