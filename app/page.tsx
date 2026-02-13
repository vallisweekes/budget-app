import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";

export default async function LoginSplashPage(props: {
	searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name ?? "";
	if (sessionUser && username) {
		const userId = await resolveUserId({ userId: sessionUser.id, username });
		const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username });
		if (!budgetPlan) redirect("/budgets/new");
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlan.id)}`);
	}

	const searchParams = await Promise.resolve(props.searchParams ?? {});
	const authParam = searchParams.auth;
	const authFlag = Array.isArray(authParam) ? authParam[0] : authParam;
	const showAuthMessage = authFlag === "1" || authFlag === "true";
	const modeParam = searchParams.mode;
	const modeRaw = Array.isArray(modeParam) ? modeParam[0] : modeParam;
	const initialMode = modeRaw === "register" ? "register" : "login";

	return (
		<div className="min-h-screen bg-[#0a0d14]">
			<div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-16">
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute left-1/2 top-1/4 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/20 blur-3xl" />
				<div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />
				<div className="absolute bottom-1/4 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />			</div>
				<div className="relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2">
					<div className="mx-auto w-full max-w-xl">

						<h1 className="mt-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
						Take control of your
						<span className="bg-gradient-to-r from-blue-200 via-white to-blue-200 bg-clip-text text-transparent"> money</span>
					</h1>
					<p className="mt-4 text-lg text-slate-300">
						Know exactly where your money's going. No stress, no surprises — just real budgeting that works for you.
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
						<LoginForm
							initialMode={initialMode}
							message={showAuthMessage ? "Please log in or register to continue." : undefined}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}



