import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { getAllIncome } from "@/lib/income/store";
import { monthKeyToNumber, monthNumberToKey, normalizeMonthKey } from "@/lib/helpers/monthKey";
import { MONTHS } from "@/lib/constants/time";
import { HeroCanvasLayout } from "@/components/Shared";
import type { MonthKey } from "@/types";
import IncomeMonthPageClient from "@/app/admin/income/IncomeMonthPageClient";

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") return Number(value);
	if (typeof value === "object") {
		const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
		if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
		if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
	}
	return Number(value);
}

function firstString(value: string | string[] | undefined): string {
	if (Array.isArray(value)) return String(value[0] ?? "");
	return typeof value === "string" ? value : "";
}

export default async function IncomeMonthPage(props: {
	budgetPlanId: string;
	monthKeyFromPath: string;
	searchParams: Record<string, string | string[] | undefined>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });

	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: props.budgetPlanId }, select: { id: true, userId: true } });
	if (!budgetPlan || budgetPlan.userId !== userId) return notFound();

	const sp = props.searchParams ?? {};
	const rawYear = Number(firstString(sp.year));
	const year = Number.isFinite(rawYear) ? rawYear : new Date().getFullYear();

	const normalizedPathMonth = normalizeMonthKey(props.monthKeyFromPath) as MonthKey | null;
	const normalizedQueryMonth = normalizeMonthKey(firstString(sp.month)) as MonthKey | null;
	const month: MonthKey | null = normalizedPathMonth ?? normalizedQueryMonth;
	if (!month) return notFound();

	const baseIncomeHref = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(props.budgetPlanId)}/page=income?year=${encodeURIComponent(
		String(year)
	)}`;
	const canonicalHref = `${baseIncomeHref.replace(/\?.*$/, "")}/${encodeURIComponent(month)}?year=${encodeURIComponent(
		String(year)
	)}&month=${encodeURIComponent(month)}`;

	// Keep URL canonical for shareability.
	if (normalizedQueryMonth !== month || firstString(sp.year) !== String(year) || !firstString(sp.month)) {
		redirect(canonicalHref);
	}

	const incomeByMonth = await getAllIncome(props.budgetPlanId, year);
	const incomeItems = incomeByMonth[month] ?? [];
	const monthKeys = MONTHS as readonly MonthKey[];
	const monthIndex = new Map(monthKeys.map((m, idx) => [m, idx] as const));

	const incomeTotalsByMonth = monthKeys.map((m) => (incomeByMonth[m] ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0));

	// Build stacked series for top income sources across the year (+ "Other").
	const totalsByName = new Map<string, number>();
	for (const m of monthKeys) {
		for (const item of incomeByMonth[m] ?? []) {
			const name = String(item.name ?? "").trim() || "Untitled";
			totalsByName.set(name, (totalsByName.get(name) ?? 0) + (item.amount ?? 0));
		}
	}
	const topNames = [...totalsByName.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 4)
		.map(([name]) => name);
	const topSet = new Set(topNames);
	const palette = [
		{ border: "rgba(52, 211, 153, 0.95)", bg: "rgba(52, 211, 153, 0.16)" }, // emerald
		{ border: "rgba(56, 189, 248, 0.95)", bg: "rgba(56, 189, 248, 0.14)" }, // sky
		{ border: "rgba(167, 139, 250, 0.95)", bg: "rgba(167, 139, 250, 0.12)" }, // violet
		{ border: "rgba(251, 191, 36, 0.95)", bg: "rgba(251, 191, 36, 0.14)" }, // amber
	];
	const incomeStacks: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string }> = topNames.map(
		(name, idx) => ({
			label: name,
			data: Array(monthKeys.length).fill(0),
			borderColor: palette[idx]?.border ?? "rgba(226, 232, 240, 0.85)",
			backgroundColor: palette[idx]?.bg ?? "rgba(226, 232, 240, 0.10)",
		})
	);
	const other = { label: "Other", data: Array(monthKeys.length).fill(0), borderColor: "rgba(148, 163, 184, 0.85)", backgroundColor: "rgba(148, 163, 184, 0.10)" };
	for (const m of monthKeys) {
		const idx = monthIndex.get(m) ?? -1;
		if (idx < 0) continue;
		for (const item of incomeByMonth[m] ?? []) {
			const name = String(item.name ?? "").trim() || "Untitled";
			const amount = item.amount ?? 0;
			const topIdx = topNames.indexOf(name);
			if (topIdx >= 0) incomeStacks[topIdx]!.data[idx] += amount;
			else if (topSet.size > 0) other.data[idx] += amount;
		}
	}
	const otherTotal = other.data.reduce((s, n) => s + n, 0);
	if (otherTotal > 0) incomeStacks.push(other);

	// Monthly expenses series for the selected year.
	const plannedExpensesByMonth = Array(monthKeys.length).fill(0);
	const paidExpensesByMonth = Array(monthKeys.length).fill(0);
	const expenseByMonthAgg = await prisma.expense.groupBy({
		by: ["month"],
		where: {
			budgetPlanId: props.budgetPlanId,
			year,
			isAllocation: false,
		},
		_sum: { amount: true, paidAmount: true },
	});
	for (const row of expenseByMonthAgg) {
		const monthNum = Number(row.month);
		const idx = Number.isFinite(monthNum) ? monthNum - 1 : -1;
		if (idx < 0 || idx >= monthKeys.length) continue;
		plannedExpensesByMonth[idx] = decimalToNumber(row._sum.amount);
		paidExpensesByMonth[idx] = decimalToNumber(row._sum.paidAmount);
	}

	const expenseAgg = await prisma.expense.aggregate({
		where: {
			budgetPlanId: props.budgetPlanId,
			year,
			month: monthKeyToNumber(month),
			isAllocation: false,
		},
		_sum: { amount: true, paidAmount: true },
	});

	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
	const plannedExpenses = decimalToNumber(expenseAgg._sum.amount);
	const paidExpenses = decimalToNumber(expenseAgg._sum.paidAmount);
	const remainingExpenses = Math.max(0, plannedExpenses - paidExpenses);
	const netPlanned = grossIncome - plannedExpenses;
	const netPaid = grossIncome - paidExpenses;

	return (
		<HeroCanvasLayout
			maxWidthClassName="max-w-5xl"
			hero={
				<div className="space-y-1 sm:space-y-2">
					<div className="flex items-center justify-between gap-3">
						<div>
							<h1 className="text-2xl sm:text-4xl font-bold text-white">Income</h1>
							<p className="text-slate-400 text-sm sm:text-lg">Manage income for {monthNumberToKey(monthKeyToNumber(month))} {year}</p>
						</div>
						<Link
							href={baseIncomeHref}
							className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
						>
							← Back to income
						</Link>
					</div>
				</div>
			}
		>
			<IncomeMonthPageClient
				budgetPlanId={props.budgetPlanId}
				year={year}
				month={month}
				incomeItems={incomeItems}
				yearSeries={{
					monthKeys: [...monthKeys],
					incomeStacks,
					incomeTotalsByMonth,
					plannedExpensesByMonth,
					paidExpensesByMonth,
				}}
				analysis={{
					grossIncome,
					plannedExpenses,
					paidExpenses,
					remainingExpenses,
					netPlanned,
					netPaid,
				}}
			/>
		</HeroCanvasLayout>
	);
}
