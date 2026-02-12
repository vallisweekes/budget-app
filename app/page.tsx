import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";

export default async function LoginSplashPage() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name ?? "";
	if (sessionUser && username) {
		const userId = await resolveUserId({ userId: sessionUser.id, username });
		const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username });
		if (!budgetPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlan.id)}`);
	}

	return (
		<div className="min-h-screen bg-[#0a0d14]">
			<div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-16">
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div className="absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full bg-red-500/20 blur-3xl" />
					<div className="absolute -right-32 top-10 h-[520px] w-[520px] rounded-full bg-blue-500/20 blur-3xl" />
					<div className="absolute bottom-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
				</div>

				<div className="relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2">
					<div className="mx-auto w-full max-w-xl">
						<div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
							<span className="h-2 w-2 rounded-full bg-emerald-400" />
							Budget App
						</div>
						<h1 className="mt-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
							Get a grip on your
							<span className="bg-gradient-to-r from-blue-200 via-white to-blue-200 bg-clip-text text-transparent"> finance</span>
						</h1>
						<p className="mt-4 text-lg text-slate-300">
							Track spending, plan ahead, and see where your money goes — without the clutter.
						</p>
						<div className="mt-6 flex flex-wrap gap-2">
							{["Personal", "Holiday", "Carnival"].map((label) => (
								<span
									key={label}
									className="rounded-full bg-white/5 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/10"
								>
									{label}
								</span>
							))}
						</div>
						<div className="mt-6 grid grid-cols-1 gap-3 text-sm text-slate-300">
							<div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">Simple monthly view of income, expenses, and savings.</div>
							<div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">Spot trends and overspend categories at a glance.</div>
						</div>
					</div>

					<div className="mx-auto w-full max-w-xl">
						<LoginForm />
					</div>
				</div>
			</div>
		</div>
	);
}



