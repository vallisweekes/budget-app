import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import IncomeTabs from "@/components/Admin/Income/IncomeTabs";
import AllocationsView from "@/components/Admin/Income/views/AllocationsView";
import IncomeView from "@/components/Admin/Income/views/IncomeView";
import { getAdminIncomePageData } from "@/lib/income/adminIncomePageData";

export const dynamic = "force-dynamic";

export default async function AdminIncomePage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) redirect("/");

	const searchParams = await Promise.resolve(props.searchParams ?? {});

	const data = await getAdminIncomePageData({
		searchParams,
		sessionUserId: sessionUser.id,
		sessionUsername,
	});

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-8">
				<div className="mb-5 sm:mb-10">
					<h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">Income</h1>
					<p className="text-slate-400 text-sm sm:text-lg">Manage your income sources</p>
				</div>

				<IncomeTabs
					initialTab={data.initialTab}
					allocations={
						<AllocationsView
							budgetPlanId={data.budgetPlanId}
							allocMonth={data.allocMonth}
							allocation={data.allocation}
							customAllocations={data.customAllocations}
							hasOverridesForAllocMonth={data.hasOverridesForAllocMonth}
							monthlyAllocationSummaries={data.monthlyAllocationSummaries}
							grossIncomeForAllocMonth={data.grossIncomeForAllocMonth}
							totalAllocationsForAllocMonth={data.totalAllocationsForAllocMonth}
							remainingToBudgetForAllocMonth={data.remainingToBudgetForAllocMonth}
						/>
					}
					income={
						<IncomeView
							budgetPlanId={data.budgetPlanId}
							showYearPicker={data.showYearPicker}
							allYears={data.allYears}
							selectedIncomeYear={data.selectedIncomeYear}
							hasAvailableMonths={data.hasAvailableMonths}
							defaultMonth={data.defaultMonth}
							monthsWithoutIncome={data.monthsWithoutIncome}
							income={data.incomeForIncomeTab}
						/>
					}
				/>
			</div>
		</div>
	);
}
