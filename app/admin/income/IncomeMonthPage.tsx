import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { getAllIncome } from "@/lib/income/store";
import { monthKeyToNumber, monthNumberToKey, normalizeMonthKey } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot, getMonthlyCustomAllocationsSnapshot } from "@/lib/allocations/store";
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

	const buildMonthHref = (m: MonthKey, y: number) =>
		`${baseIncomeHref.replace(/\?.*$/, "")}/${encodeURIComponent(m)}?year=${encodeURIComponent(String(y))}&month=${encodeURIComponent(m)}`;
	const monthNum = monthKeyToNumber(month);
	const prevYear = monthNum === 1 ? year - 1 : year;
	type MonthNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
	const prevMonthNum = (monthNum === 1 ? 12 : (monthNum - 1)) as MonthNum;
	const prevMonth = monthNumberToKey(prevMonthNum);

	const nextYear = monthNum === 12 ? year + 1 : year;
	const nextMonthNum = (monthNum === 12 ? 1 : (monthNum + 1)) as MonthNum;
	const nextMonth = monthNumberToKey(nextMonthNum);

	// Keep URL canonical for shareability.
	if (normalizedQueryMonth !== month || firstString(sp.year) !== String(year) || !firstString(sp.month)) {
		redirect(canonicalHref);
	}

	const incomeByMonth = await getAllIncome(props.budgetPlanId, year);
	const incomeItems = incomeByMonth[month] ?? [];
	const expenseAgg = await prisma.expense.aggregate({
		where: {
			budgetPlanId: props.budgetPlanId,
			year,
			month: monthKeyToNumber(month),
			isAllocation: false,
		},
		_sum: { amount: true, paidAmount: true },
	});

	// IMPORTANT: "Allowances" here means the monthly allowance settings (and custom allowance items)
	// from the allocations system — NOT Expense rows marked as isAllocation.
	const allocationSnapshot = await getMonthlyAllocationSnapshot(props.budgetPlanId, month, { year });
	const customAllocationsSnapshot = await getMonthlyCustomAllocationsSnapshot(props.budgetPlanId, month, { year });

	const plannedDebtAgg = await prisma.debt.aggregate({
		where: {
			budgetPlanId: props.budgetPlanId,
			paid: false,
			currentBalance: { gt: 0 },
			defaultPaymentSource: "income",
		},
		_sum: { amount: true },
	});

	const paidDebtAggFromIncome = await prisma.debtPayment.aggregate({
		where: {
			debt: { budgetPlanId: props.budgetPlanId },
			year,
			month: monthKeyToNumber(month),
			source: "income",
		},
		_sum: { amount: true },
	});

	const grossIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
	const plannedExpenses = decimalToNumber(expenseAgg._sum.amount);
	const paidExpenses = decimalToNumber(expenseAgg._sum.paidAmount);
	const monthlyAllowance = Number(allocationSnapshot.monthlyAllowance ?? 0);
	const plannedSetAsideFromAllocations =
		Number(allocationSnapshot.monthlySavingsContribution ?? 0) +
		Number(allocationSnapshot.monthlyEmergencyContribution ?? 0) +
		Number(allocationSnapshot.monthlyInvestmentContribution ?? 0);
	const customSetAsideTotal = Number(customAllocationsSnapshot.total ?? 0);
	const plannedSetAside = plannedSetAsideFromAllocations + customSetAsideTotal;
	const plannedDebtPayments = decimalToNumber(plannedDebtAgg._sum.amount);
	const paidDebtPaymentsFromIncome = decimalToNumber(paidDebtAggFromIncome._sum.amount);

	const plannedBills = plannedExpenses + plannedDebtPayments;
	const paidBillsSoFar = paidExpenses + paidDebtPaymentsFromIncome;
	const remainingBills = Math.max(0, plannedBills - paidBillsSoFar);
	const moneyLeftAfterPlan = grossIncome - (plannedBills + monthlyAllowance + plannedSetAside);
	const incomeLeftToBudgetAfterSacrificeAndDebtPlan = grossIncome - plannedSetAside - plannedDebtPayments;
	const remainingAfterRecordedExpenses = incomeLeftToBudgetAfterSacrificeAndDebtPlan - plannedExpenses;

	return (
		<HeroCanvasLayout
			maxWidthClassName="max-w-5xl"
			hero={
				<div className="space-y-3">
					<div className="flex justify-center">
						<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5">
							<Link
								href={buildMonthHref(prevMonth, prevYear)}
								className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 transition"
								aria-label={`Previous month (${prevMonth} ${prevYear})`}
								prefetch={false}
							>
								‹
							</Link>
							<div className="px-2 text-sm sm:text-base font-semibold text-white whitespace-nowrap">
								{monthNumberToKey(monthKeyToNumber(month))} {year}
							</div>
							<Link
								href={buildMonthHref(nextMonth, nextYear)}
								className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 transition"
								aria-label={`Next month (${nextMonth} ${nextYear})`}
								prefetch={false}
							>
								›
							</Link>
						</div>
					</div>
					<div className="flex justify-start">
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
				analysis={{
					grossIncome,
					plannedExpenses,
					plannedDebtPayments,
					plannedAllowances: monthlyAllowance,
					plannedSetAside,
					incomeLeftToBudgetAfterSacrificeAndDebtPlan,
					remainingAfterRecordedExpenses,
					setAsideBreakdown: {
						fromAllocations: plannedSetAsideFromAllocations,
						customTotal: customSetAsideTotal,
						customCount: customAllocationsSnapshot.items?.length ?? 0,
						isAllowanceOverride: !!allocationSnapshot.isOverride,
					},
					paidExpenses,
					paidDebtPaymentsFromIncome,
					remainingBills,
					moneyLeftAfterPlan,
				}}
			/>
		</HeroCanvasLayout>
	);
}
