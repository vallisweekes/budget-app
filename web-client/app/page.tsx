import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { getOnboardingForUser } from "@/lib/onboarding";

export default async function HomePage() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name ?? "";
	if (sessionUser && username) {
		const userId = await resolveUserId({ userId: sessionUser.id, username });
		const onboarding = await getOnboardingForUser(userId);
		if (onboarding.required) redirect("/onboarding");
		const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username });
		if (!budgetPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlan.id)}/page=home`);
	}

	return (
		<div className="min-h-screen bg-white text-slate-900">
			<header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
				<div className="text-xl font-bold tracking-tight">BudgetIn Check</div>
				<Link
					href="/login"
					className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
				>
					Log in
				</Link>
			</header>

			<section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-8 lg:grid-cols-2">
				<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
					<div className="absolute left-10 top-4 h-64 w-64 rounded-full bg-blue-200/60 blur-3xl" />
					<div className="absolute bottom-2 right-10 h-72 w-72 rounded-full bg-cyan-200/60 blur-3xl" />
				</div>

				<div>
					<h1 className="text-4xl font-bold tracking-tight md:text-6xl">
						Take control of your money with one clear budget app
					</h1>
					<p className="mt-5 max-w-xl text-lg text-slate-600">
						Track spending, stay ahead of bills, and keep your goals on track with a simple monthly workflow.
					</p>
					<ul className="mt-6 space-y-2 text-slate-700">
						<li>• See income, expenses, debts, and goals in one view</li>
						<li>• Keep upcoming bills visible before due dates</li>
						<li>• Track progress with focused, mobile-first dashboards</li>
					</ul>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link href="/login" className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500">
							Get started
						</Link>
						<Link
							href="/login?mode=register"
							className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-900 hover:bg-slate-100"
						>
							Create account
						</Link>
					</div>
				</div>

				<div className="relative h-[360px] w-full overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-[#17155a] via-[#232175] to-[#17155a]">
					<div className="absolute -left-16 top-10 h-56 w-56 rotate-12 rounded-[48px] border-[22px] border-cyan-400/75" />
					<div className="absolute right-[-30px] top-[-26px] h-72 w-44 rounded-[34px] bg-white/95 shadow-2xl" />
					<div className="absolute right-24 top-10 h-72 w-44 rounded-[34px] bg-white/90 shadow-2xl" />
					<div className="absolute right-[-10px] top-[116px] rounded-2xl border border-slate-300/30 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg">
						You’ve got enough cash to cover your bills until payday
					</div>
					<div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#15134f] to-transparent" />
				</div>
			</section>

			<footer className="border-t border-slate-200 bg-white">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
					<p>© {new Date().getFullYear()} BudgetIn Check</p>
					<div className="flex flex-wrap items-center gap-4">
						<Link href="/privacy-policy" className="hover:text-slate-900">Privacy Policy</Link>
						<Link href="/terms" className="hover:text-slate-900">Terms & Conditions</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}



