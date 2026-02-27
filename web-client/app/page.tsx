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
			<div className="relative overflow-hidden bg-gradient-to-b from-[#2a0a9e] to-[#16085f] text-white">
				<header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
					<div className="text-xl font-bold tracking-tight">BudgetIn Check</div>
					<Link
						href="/login"
						className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
					>
						Log in
					</Link>
				</header>

				<section className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-8">
					<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
						<div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl" />
						<div className="absolute left-44 top-[-140px] h-[560px] w-[560px] rounded-full bg-sky-400/20 blur-3xl" />
						<div className="absolute right-[-160px] top-6 h-[560px] w-[560px] rounded-full bg-cyan-300/20 blur-3xl" />
					</div>

					<div className="mx-auto max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight md:text-6xl">
							Take control of your money with one clear budget app
						</h1>
						<p className="mt-5 max-w-xl text-lg text-white/80">
							Track spending, stay ahead of bills, and keep your goals on track with a simple monthly workflow.
						</p>
						<ul className="mt-6 space-y-3 text-white/90">
							<li>
								<span className="mr-3 align-middle text-pink-400">•</span>
								<span className="align-middle">See income, expenses, debts, and goals in one view</span>
							</li>
							<li>
								<span className="mr-3 align-middle text-pink-400">•</span>
								<span className="align-middle">Keep upcoming bills visible before due dates</span>
							</li>
							<li>
								<span className="mr-3 align-middle text-pink-400">•</span>
								<span className="align-middle">Track progress with focused, mobile-first dashboards</span>
							</li>
						</ul>
						<div className="mt-8 flex flex-wrap items-center gap-3">
							<Link
								href="/login"
								className="rounded-xl bg-white px-5 py-3 font-semibold text-indigo-950 hover:bg-white/90"
							>
								Get started
							</Link>
							<Link
								href="/login?mode=register"
								className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/10"
							>
								Create account
							</Link>
						</div>
					</div>
				</section>

				<svg
					className="pointer-events-none absolute bottom-[-1px] left-0 h-28 w-full fill-white"
					viewBox="0 0 1440 120"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					<path d="M0,0 C240,90 480,120 720,120 C960,120 1200,90 1440,0 L1440,120 L0,120 Z" />
				</svg>
			</div>

			<footer className="border-t border-slate-200 bg-white">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
					<p>© {new Date().getFullYear()} BudgetIn Check</p>
					<div className="flex flex-wrap items-center gap-4">
						<Link href="/privacy-policy" className="hover:text-slate-900">
							Privacy Policy
						</Link>
						<Link href="/terms" className="hover:text-slate-900">
							Terms & Conditions
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}



