"use client";

import { formatCurrency } from "@/lib/helpers/money";
import {
	Chart as ChartJS,
	ArcElement,
	Tooltip,
	Legend,
	type ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PieCategories({ items }: { items: Array<{ name: string; amount: number }> }) {
  const total = items.reduce((a, b) => a + b.amount, 0);
  const colors = ["#4f46e5", "#ef4444", "#22c55e", "#f59e0b", "#06b6d4", "#a855f7", "#fb8c50"];

  const labels = items.map((i) => i.name);
  const values = items.map((i) => i.amount);
  const backgroundColor = items.map((_, i) => colors[i % colors.length]);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor,
        borderColor: "rgba(15, 23, 42, 0.55)",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || "";
            const val = typeof ctx.parsed === "number" ? ctx.parsed : 0;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return `${label}: ${formatCurrency(val)}${total > 0 ? ` (${pct}%)` : ""}`;
          },
        },
      },
    },
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-32 w-32">
        <Doughnut data={data} options={options} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs w-full">
        {items.slice(0, 8).map((s, i) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded" style={{ background: colors[i % colors.length] }} />
            <span className="truncate">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
