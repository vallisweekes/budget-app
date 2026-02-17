import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { isSupportedBudgetType, listBudgetPlansForUser } from "@/lib/budgetPlans";
import CreateBudgetForm, { type BudgetType } from "./CreateBudgetForm";
import { createBudgetPlanAction } from "./actions";

export default async function NewBudgetPageContent({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const username = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !username) {
		redirect("/");
	}

	const plans = await listBudgetPlansForUser({ userId: sessionUser.id, username });
	const hasPersonalPlan = plans.some((p) => String(p.kind).toLowerCase() === "personal");

	const sp = await searchParams;
	const raw = Array.isArray(sp.type) ? sp.type[0] : sp.type;
	const typeRaw = String(raw ?? "personal").trim().toLowerCase();
	const returnToRaw = Array.isArray(sp.returnTo) ? sp.returnTo[0] : sp.returnTo;
	const returnTo = typeof returnToRaw === "string" && returnToRaw.startsWith("/") ? returnToRaw : undefined;
	const requestedBudgetType: BudgetType = (isSupportedBudgetType(typeRaw) ? typeRaw : "personal") as BudgetType;
	const defaultBudgetType: BudgetType = hasPersonalPlan ? requestedBudgetType : "personal";

	return (
		<div className="min-h-screen app-theme-bg">
			<div className="relative mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-16">
				<div className="w-full">
					{returnTo ? (
						<Link href={returnTo} className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
							← Back
						</Link>
					) : null}
					<h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
						Create a new budget
					</h1>
					<p className="mt-3 text-slate-300">
						You’re signed in as <span className="font-semibold text-slate-200">{username}</span>.
					</p>

					{plans.length > 0 && (
						<div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
							<p className="text-sm font-semibold text-slate-200">Your existing budgets</p>
							<div className="mt-3 grid gap-2">
								{plans.map((p) => (
									<Link
										key={p.id}
										href={`/user=${encodeURIComponent(username)}/${encodeURIComponent(p.id)}`}
										className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
									>
										<span className="font-medium">{p.name}</span>
										<span className="text-xs uppercase tracking-wide text-slate-400">{p.kind}</span>
									</Link>
								))}
							</div>
						</div>
					)}

					<CreateBudgetForm
						action={createBudgetPlanAction}
						defaultBudgetType={defaultBudgetType}
						hasPersonalPlan={hasPersonalPlan}
						returnTo={returnTo}
					/>
				</div>
			</div>
		</div>
	);
}
