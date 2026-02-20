"use client";

import { useEffect, useMemo, useState } from "react";
import type { PreviousMonthRecap, UpcomingPayment, RecapTip } from "@/lib/expenses/insights";
import { Card } from "@/components/Shared";
import { formatCurrency } from "@/lib/helpers/money";

const dueMonthFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	timeZone: "UTC",
});

function ordinalSuffix(day: number): string {
	const d = Math.trunc(day);
	const mod100 = d % 100;
	if (mod100 >= 11 && mod100 <= 13) return "th";
	switch (d % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}

function formatIsoDueDateOrdinal(iso: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
	const [year, month, day] = iso.split("-").map((x) => Number(x));
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return iso;
	const dt = new Date(Date.UTC(year, month - 1, day));
	const monthLabel = dueMonthFormatter.format(dt);
	const dayNum = dt.getUTCDate();
	return `${monthLabel} ${dayNum}${ordinalSuffix(dayNum)}`;
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

function dotClass(kind: "ok" | "warn" | "bad" | "muted"): string {
	switch (kind) {
		case "ok":
			return "bg-emerald-400";
		case "warn":
			return "bg-amber-400";
		case "bad":
			return "bg-red-400";
		default:
			return "bg-slate-400";
	}
}

function titleCaseIfAllCaps(value: string): string {
	const s = String(value ?? "").trim();
	if (!s) return s;
	if (!/[A-Za-z]/.test(s)) return s;
	if (s !== s.toUpperCase()) return s;
	return s
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

function normalizeUpcomingName(rawName: string): string {
	let s = String(rawName ?? "").trim();
	if (!s) return s;

	// Remove trailing auto-appended date tokens like "(2026-01)", "(2026-01 2026)", or "(2026-01 2026-01)".
	s = s.replace(/\s*\((\d{4}-\d{2})(?:\s+\d{4}(?:-\d{2})?)?\)\s*$/u, "").trim();

	// Remove any legacy debt suffix if present.
	s = s.replace(/\s*\(Debt\)\s*$/i, "").trim();

	// If there's a category prefix (e.g. "Housing: RENT"), title-case ALL CAPS parts on each side.
	if (s.includes(":")) {
		const idx = s.indexOf(":");
		const left = s.slice(0, idx).trim();
		const right = s.slice(idx + 1).trim();
		const leftNice = titleCaseIfAllCaps(left);
		const rightNice = titleCaseIfAllCaps(right);
		return rightNice ? `${leftNice}: ${rightNice}` : leftNice;
	}

	return titleCaseIfAllCaps(s);
}

function urgencyTone(urgency: UpcomingPayment["urgency"]): "ok" | "warn" | "bad" {
	if (urgency === "overdue" || urgency === "today") return "bad";
	if (urgency === "soon") return "warn";
	return "ok";
}

function urgencySuffix(urgency: UpcomingPayment["urgency"]): string {
	return "";
}

function dueLabel(u: UpcomingPayment): string {
	if (u.urgency === "today") return "Due Today";
	if (u.urgency === "overdue") return "Past Due Date";
	return `Due on ${formatIsoDueDateOrdinal(u.dueDate)}${urgencySuffix(u.urgency)}`;
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
	const shouldShowRecap = showRecap && !!recap;
	const shouldShowUpcoming = showUpcoming;

	const tips = useMemo(() => {
		return Array.isArray(recapTips) ? recapTips.filter((t) => t && t.title && t.detail) : [];
	}, [recapTips]);

	const [tipIndex, setTipIndex] = useState(0);

	useEffect(() => {
		if (tips.length <= 1) return;
		const id = window.setInterval(() => {
			setTipIndex((i) => (tips.length ? (i + 1) % tips.length : 0));
		}, 20_000);
		return () => window.clearInterval(id);
	}, [tips.length]);

	const activeTip = tips.length ? tips[tipIndex % tips.length] : null;
	const shouldShowTipCard = !!activeTip && (shouldShowRecap || shouldShowUpcoming);
	const tipBlock = activeTip ? (
		<div>
			<div className="text-xs uppercase tracking-wide text-slate-400">Tip</div>
			<div className="mt-1 text-sm font-semibold text-white">{activeTip.title}</div>
			<div className="mt-0.5 text-xs text-slate-300">{activeTip.detail}</div>
		</div>
	) : null;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-3">
			{shouldShowRecap ? (
				<Card
					title={undefined}
					className={shouldShowUpcoming ? "lg:col-span-6 lg:row-start-1" : "lg:col-span-12"}
				>
					<div className="space-y-2">
						<div className="inline-flex">
							<div
								className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
								style={{ backgroundColor: "#9EDBFF" }}
							>
								{toTitleCaseMonthOnly(recap!.label)} Recap
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className={`rounded-2xl border p-2.5 ${badgeClass("ok")}`}>
								<div className="text-xs uppercase tracking-wide opacity-90">Paid</div>
								<div className="mt-1 text-base font-bold">{recap!.paidCount}</div>
								<div className="text-xs opacity-90">{money(recap!.paidAmount)}</div>
							</div>
							<div className={`rounded-2xl border p-2.5 ${badgeClass(recap!.unpaidCount > 0 ? "warn" : "muted")}`}>
								<div className="text-xs uppercase tracking-wide opacity-90">Not paid</div>
								<div className="mt-1 text-base font-bold">{recap!.unpaidCount + recap!.partialCount}</div>
								<div className="text-xs opacity-90">{money(recap!.unpaidAmount + recap!.partialAmount)}</div>
							</div>
						</div>

						<div className={`rounded-2xl border p-2.5 ${badgeClass(recap!.missedDueCount > 0 ? "bad" : "muted")}`}>
							<div className="flex items-center justify-between gap-3">
								<div className="text-xs uppercase tracking-wide opacity-90">Missed due date</div>
								<div className="text-xs opacity-80">(due by month end)</div>
							</div>
							<div className="mt-1 flex items-end justify-between gap-3">
								<div className="text-base font-bold">{recap!.missedDueCount}</div>
								<div className="text-sm font-semibold">{money(recap!.missedDueAmount)}</div>
							</div>
						</div>
					</div>
				</Card>
			) : null}

			{shouldShowUpcoming ? (
				<Card
					title={undefined}
					className={
						shouldShowRecap && shouldShowTipCard
							? "lg:col-span-6 lg:row-start-1 lg:row-span-2"
							: shouldShowRecap
								? "lg:col-span-6"
								: "lg:col-span-12"
					}
				>
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
								const tagTone = urgencyTone(u.urgency);
								const isDebt = u.id.startsWith("debt:") || u.id.startsWith("debt-expense:");
								const isMissPaymentDebt = u.id.startsWith("debt-expense:");
								const displayName = normalizeUpcomingName(u.name);
								return (
									<div
										key={u.id}
										className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2 text-slate-200"
									>
										<div className="min-w-0">
											<div className="inline-flex items-center gap-1 min-w-0">
												<span
													aria-hidden
													className={`h-1 w-1 rounded-full shrink-0 ${dotClass(tagTone)}`}
												/>
												<div className="text-[12px] leading-none font-semibold truncate">{displayName}</div>
											</div>
											<div className="mt-1 flex items-center gap-2">
												<div
													className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-semibold ${badgeClass(
														tagTone
													)}`}
													title={
														u.urgency === "overdue"
															? "Overdue payment"
														: u.urgency === "today"
															? "Payment due today"
															: u.urgency === "soon"
																? "Payment due soon"
																: "Upcoming payment"
													}
												>
													{dueLabel(u)}
												</div>
												{isDebt ? (
													<div className="inline-flex items-center rounded-md border border-white/10 bg-slate-950/40 px-2 py-0.5 text-[8px] font-semibold text-slate-200">
														{isMissPaymentDebt ? "Miss Payment Debt" : "Debt"}
													</div>
												) : null}
											</div>
										</div>
										<div className="text-right whitespace-nowrap">
											<div className="text-sm font-bold">{money(u.amount)}</div>
											{u.status !== "paid" ? (
												<div className="text-xs text-slate-300">
													Remaining {money(Math.max(0, u.amount - u.paidAmount))}
												</div>
											) : (
												<div className="text-xs text-slate-300">Paid</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</Card>
			) : null}

			{shouldShowTipCard ? (
				<Card
					title={undefined}
					className={
						shouldShowRecap && shouldShowUpcoming
							? "lg:col-span-6 lg:row-start-2 h-full"
							: shouldShowUpcoming
								? "lg:col-span-12"
								: "lg:col-span-12"
					}
				>
					<div className="h-full flex flex-col justify-center">{tipBlock}</div>
				</Card>
			) : null}
		</div>
	);
}
