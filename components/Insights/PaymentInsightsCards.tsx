"use client";

import { useEffect, useMemo, useState } from "react";
import type { PreviousMonthRecap, UpcomingPayment, RecapTip } from "@/lib/expenses/insights";
import { Card } from "@/components/Shared";
import { formatCurrency } from "@/lib/helpers/money";

const dueDateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

function formatIsoDueDate(iso: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
	const [year, month, day] = iso.split("-").map((x) => Number(x));
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return iso;
	return dueDateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function money(value: number): string {
	return formatCurrency(Number.isFinite(value) ? value : 0);
}

function badgeClass(kind: "ok" | "warn" | "bad" | "muted"): string {
	switch (kind) {
		case "ok":
			return "bg-emerald-500/20 text-emerald-200 border-emerald-400/20";
		case "warn":
			return "bg-amber-500/20 text-amber-200 border-amber-400/20";
		case "bad":
			return "bg-red-500/20 text-red-200 border-red-400/20";
		default:
			return "bg-white/10 text-slate-200 border-white/10";
	}
}

function toTitleCaseMonthOnly(label: string): string {
	const trimmed = String(label ?? "").trim();
	if (!trimmed) return "";
	const parts = trimmed.split(/\s+/);
	if (parts.length < 1) return trimmed;
	const month = parts[0];
	const monthTc = month.length ? month[0].toUpperCase() + month.slice(1).toLowerCase() : month;
	return monthTc;
}

export default function PaymentInsightsCards({
	recap,
	recapTips,
	upcoming,
	showRecap = true,
	showUpcoming = true,
}: {
	recap?: PreviousMonthRecap | null;
	recapTips?: RecapTip[] | null;
	upcoming?: UpcomingPayment[] | null;
	showRecap?: boolean;
	showUpcoming?: boolean;
}) {
	const shouldShowRecap = showRecap;
	const shouldShowUpcoming = showUpcoming;

	const tips = useMemo(() => {
		return Array.isArray(recapTips) ? recapTips.filter((t) => t && t.title && t.detail) : [];
	}, [recapTips]);

	const [tipIndex, setTipIndex] = useState(0);

	useEffect(() => {
		setTipIndex(0);
		if (tips.length <= 1) return;
		const id = window.setInterval(() => {
			setTipIndex((i) => (tips.length ? (i + 1) % tips.length : 0));
		}, 50_000);
		return () => window.clearInterval(id);
	}, [tips.length]);

	const activeTip = tips.length ? tips[tipIndex % tips.length] : null;

	return (
		<div
			className={`grid grid-cols-1 lg:grid-cols-12 gap-3 ${
				shouldShowRecap && shouldShowUpcoming ? "" : "lg:grid-cols-1"
			}`}
		>
			{shouldShowRecap ? (
				<Card
					title={undefined}
					className={shouldShowUpcoming ? "lg:col-span-6" : "lg:col-span-12"}
				>
				{!recap ? (
					<div className="text-sm text-slate-300">No recap available.</div>
				) : (
					<div className="space-y-3">
						<div className="inline-flex">
							<div
								className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
								style={{ backgroundColor: "#9EDBFF" }}
							>
								{toTitleCaseMonthOnly(recap.label)} Recap
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className={`rounded-2xl border p-3 ${badgeClass("ok")}`}>
								<div className="text-xs uppercase tracking-wide opacity-90">Paid</div>
								<div className="mt-1 text-lg font-bold">{recap.paidCount}</div>
								<div className="text-xs opacity-90">{money(recap.paidAmount)}</div>
							</div>
							<div className={`rounded-2xl border p-3 ${badgeClass(recap.unpaidCount > 0 ? "warn" : "muted")}`}>
								<div className="text-xs uppercase tracking-wide opacity-90">Not paid</div>
								<div className="mt-1 text-lg font-bold">{recap.unpaidCount + recap.partialCount}</div>
								<div className="text-xs opacity-90">{money(recap.unpaidAmount + recap.partialAmount)}</div>
							</div>
						</div>

						<div className={`rounded-2xl border p-3 ${badgeClass(recap.missedDueCount > 0 ? "bad" : "muted")}`}>
							<div className="flex items-center justify-between gap-3">
								<div className="text-xs uppercase tracking-wide opacity-90">Missed due date</div>
								<div className="text-xs opacity-80">(due by month end)</div>
							</div>
							<div className="mt-1 flex items-end justify-between gap-3">
								<div className="text-lg font-bold">{recap.missedDueCount}</div>
								<div className="text-sm font-semibold">{money(recap.missedDueAmount)}</div>
							</div>
						</div>

						{recap.missedDueCount > 0 && activeTip ? (
							<div className="pt-1">
								<div className="text-xs uppercase tracking-wide text-slate-400">Tip</div>
								<div className="mt-1 text-sm font-semibold text-white">{activeTip.title}</div>
								<div className="mt-0.5 text-xs text-slate-300">{activeTip.detail}</div>
							</div>
						) : null}

						<div className="text-xs text-slate-400">
							Recap uses your current payment totals (no payment timestamps yet).
						</div>
					</div>
				)}
				</Card>
			) : null}

			{shouldShowUpcoming ? (
				<Card title={undefined} className={shouldShowRecap ? "lg:col-span-6" : "lg:col-span-12"}>
				{!upcoming || upcoming.length === 0 ? (
					<div className="space-y-3">
						<div className="inline-flex">
							<div
								className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
								style={{ backgroundColor: "#9EDBFF" }}
							>
								Upcoming payments
							</div>
						</div>
						<div className="text-sm text-slate-300">Nothing urgent right now.</div>
					</div>
				) : (
					<div className="space-y-2">
						<div className="inline-flex">
							<div
								className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
								style={{ backgroundColor: "#9EDBFF" }}
							>
								Upcoming payments
							</div>
						</div>
						{upcoming.map((u) => {
							const tone =
								u.urgency === "overdue" ? "bad" : u.urgency === "today" ? "warn" : u.urgency === "soon" ? "warn" : "muted";
							return (
								<div
									key={u.id}
									className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${badgeClass(tone)}`}
								>
									<div className="min-w-0">
										<div className="text-sm font-semibold truncate">{u.name}</div>
										<div className="text-xs opacity-90">
											Due {formatIsoDueDate(u.dueDate)}
											{u.urgency === "overdue" ? " (overdue)" : u.urgency === "today" ? " (today)" : u.urgency === "soon" ? " (soon)" : ""}
										</div>
									</div>
									<div className="text-right whitespace-nowrap">
										<div className="text-sm font-bold">{money(u.amount)}</div>
										{u.status !== "paid" ? (
											<div className="text-xs opacity-90">Remaining {money(Math.max(0, u.amount - u.paidAmount))}</div>
										) : (
											<div className="text-xs opacity-90">Paid</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
				</Card>
			) : null}
		</div>
	);
}
