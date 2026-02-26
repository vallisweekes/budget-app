import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";

import { formatCurrencyCompact, formatCurrencyWhole } from "@/lib/helpers/currencyFormat";
import type { GoalsProjectionPoint } from "@/lib/helpers/goalsProjection";

export function buildGoalsProjectionChart(params: {
	points: GoalsProjectionPoint[];
	baseYear: number;
}): GoalsProjectionChartConfig | null {
	const { points, baseYear } = params;
	if (points.length < 2) return null;

	const savingsSeries = points.map((p) => ({ x: p.t, y: p.savings }));
	const emergencySeries = points.map((p) => ({ x: p.t, y: p.emergency }));
	const investmentsSeries = points.map((p) => ({ x: p.t, y: p.investments }));

	const maxVal = Math.max(...points.map((p) => Math.max(p.savings, p.emergency, p.investments)), 1);
	const suggestedMax = Math.ceil(maxVal / 1000) * 1000;

	const data: ChartData<"line"> = {
		datasets: [
			{
				label: "Savings",
				data: savingsSeries,
				borderColor: "rgba(52, 211, 153, 0.95)",
				backgroundColor: "rgba(52, 211, 153, 0.18)",
				fill: true,
				tension: 0.2,
				borderWidth: 4,
				pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === points.length - 1 ? 4 : 0),
				pointHoverRadius: 5,
			},
			{
				label: "Emergency",
				data: emergencySeries,
				borderColor: "rgba(56, 189, 248, 0.95)",
				backgroundColor: "rgba(56, 189, 248, 0.14)",
				fill: true,
				tension: 0.2,
				borderWidth: 4,
				pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === points.length - 1 ? 4 : 0),
				pointHoverRadius: 5,
			},
			{
				label: "Investments",
				data: investmentsSeries,
				borderColor: "rgba(167, 139, 250, 0.95)",
				backgroundColor: "rgba(167, 139, 250, 0.12)",
				fill: true,
				tension: 0.2,
				borderWidth: 4,
				pointRadius: (ctx: ScriptableContext<"line">) => (ctx.dataIndex === points.length - 1 ? 4 : 0),
				pointHoverRadius: 5,
			},
		],
	};

	const options: ChartOptions<"line"> = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				enabled: true,
				mode: "index",
				intersect: false,
				callbacks: {
					title: (items) => {
						const t = Number(items?.[0]?.parsed?.x ?? 0);
						if (t <= 0) return String(baseYear);
						const years = Math.floor(t / 12);
						const months = t % 12;
						if (years <= 0) return `+${t}m`;
						if (months === 0) return `+${years}y`;
						return `+${years}y ${months}m`;
					},
					label: (item) => `${item.dataset.label}: ${formatCurrencyWhole(item.parsed.y ?? 0)}`,
				},
			},
		},
		interaction: { mode: "index", intersect: false },
		scales: {
			x: {
				type: "linear",
				grid: { display: false },
				ticks: {
					color: "rgba(226, 232, 240, 0.6)",
					maxRotation: 0,
					minRotation: 0,
					autoSkip: true,
					stepSize: 12,
					maxTicksLimit: 7,
					autoSkipPadding: 28,
					callback: (val) => String(baseYear + Math.floor(Number(val) / 12)),
				},
			},
			y: {
				beginAtZero: true,
				suggestedMax,
				grid: { color: "rgba(255,255,255,0.10)" },
				ticks: {
					color: "rgba(226, 232, 240, 0.65)",
					callback: (val) => formatCurrencyCompact(Number(val)),
				},
			},
		},
	};

	return { data, options, maxVal: suggestedMax };
}

export type GoalsProjectionChartConfig = {
	data: ChartData<"line">;
	options: ChartOptions<"line">;
	maxVal: number;
};
