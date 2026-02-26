import { prisma } from "@/lib/prisma";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";

type ThresholdPushParams = {
	budgetPlanId: string;
	/** Category that was just affected */
	categoryId: string | null | undefined;
	categoryName: string | null | undefined;
	month: number;
	year: number;
	userId: string;
	/**
	 * Net change in this expense's amount contribution to the category.
	 * Positive = expense added or amount increased.
	 * Pass 0 if you don't need "newly crossed" detection (will always push when >= threshold).
	 */
	amountDelta: number;
};

const THRESHOLD_PCT = 80;
const EXCEEDED_PCT = 100;

function decimalToNumber(v: unknown): number {
	if (typeof v === "number") return v;
	if (typeof v === "string") return parseFloat(v) || 0;
	if (v && typeof (v as { toString: () => string }).toString === "function") {
		return parseFloat((v as { toString: () => string }).toString()) || 0;
	}
	return 0;
}

/**
 * After adding or editing an expense, checks whether the category's total
 * amount has crossed the 80% or 100% mark relative to monthly income.
 * Fires a mobile push only when the threshold is newly crossed (old total
 * was below, new total is at or above).
 *
 * Runs in the background — never throws, so it can't break the expense API.
 */
export async function maybeSendCategoryThresholdPush(params: ThresholdPushParams): Promise<void> {
	try {
		const { budgetPlanId, categoryId, categoryName, month, year, userId, amountDelta } = params;

		// No category or no increase in spending → nothing to check
		if (!categoryId || amountDelta <= 0) return;

		// 1 — Category total (post-update) for this month
		const categoryAgg = await prisma.expense.aggregate({
			where: {
				budgetPlanId,
				categoryId,
				month,
				year,
				isAllocation: false,
			},
			_sum: { amount: true },
		});
		const newCategoryTotal = decimalToNumber((categoryAgg._sum as Record<string, unknown>)?.amount);
		if (newCategoryTotal <= 0) return;

		// 2 — Total monthly income
		const incomeAgg = await prisma.income.aggregate({
			where: { budgetPlanId, month, year },
			_sum: { amount: true },
		});
		const totalIncome = decimalToNumber((incomeAgg._sum as Record<string, unknown>)?.amount);
		if (totalIncome <= 0) return;

		// 3 — Compute old vs new percentages
		const oldCategoryTotal = Math.max(0, newCategoryTotal - amountDelta);
		const newPct = (newCategoryTotal / totalIncome) * 100;
		const oldPct = (oldCategoryTotal / totalIncome) * 100;

		// 4 — Determine if a threshold was newly crossed
		let title: string | null = null;
		let body: string | null = null;
		const name = categoryName ?? "A category";

		if (oldPct < EXCEEDED_PCT && newPct >= EXCEEDED_PCT) {
			title = `${name} budget exceeded 🚨`;
			body = `${name} has gone over your monthly income allocation. You may want to review.`;
		} else if (oldPct < THRESHOLD_PCT && newPct >= THRESHOLD_PCT) {
			title = `${name} at ${Math.round(newPct)}% of income ⚠️`;
			body = `You've used ${Math.round(newPct)}% of your monthly income on ${name} this month.`;
		}

		if (!title) return;

		// 5 — Fetch user's mobile tokens
		const tokens = await (
			(prisma as unknown as Record<string, unknown>)["mobilePushToken"] as {
				findMany: (args: unknown) => Promise<Array<{ token: string }>>;
			}
		).findMany({
			where: { userId },
			select: { token: true },
		});

		if (!tokens.length) return;

		const pushData: Record<string, unknown> = {
			type: "category_threshold",
			categoryId: categoryId ?? null,
			month,
			year,
		};

		const { invalidTokens } = await sendMobilePushNotifications(
			tokens.map((t) => t.token),
			{ title: title!, body: body ?? undefined, data: pushData }
		);

		// 6 — Prune stale tokens
		if (invalidTokens.length > 0) {
			await (
				(prisma as unknown as Record<string, unknown>)["mobilePushToken"] as {
					deleteMany: (args: { where: { token: { in: string[] } } }) => Promise<unknown>;
				}
			).deleteMany({ where: { token: { in: invalidTokens } } });
		}
	} catch {
		// Never let push logic break the expense API
	}
}
