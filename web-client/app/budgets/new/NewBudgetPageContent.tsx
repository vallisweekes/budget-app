import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
	const typeRaw = String(raw ?? "").trim().toLowerCase();
	const typeProvided = Boolean(typeRaw);
	const returnToRaw = Array.isArray(sp.returnTo) ? sp.returnTo[0] : sp.returnTo;
	const returnToLegacy = typeof returnToRaw === "string" && returnToRaw.startsWith("/") ? returnToRaw : undefined;
	const returnToPageRaw = Array.isArray(sp.returnToPage) ? sp.returnToPage[0] : sp.returnToPage;
	const returnToSectionRaw = Array.isArray(sp.returnToSection) ? sp.returnToSection[0] : sp.returnToSection;
	const returnToPlanIdRaw = Array.isArray(sp.returnToPlanId) ? sp.returnToPlanId[0] : sp.returnToPlanId;
	const returnToPage = String(returnToPageRaw ?? "").trim().toLowerCase();
	const returnToSection = String(returnToSectionRaw ?? "").trim().toLowerCase();
	const returnToPlanId = String(returnToPlanIdRaw ?? "").trim();
	const returnToStructured =
		returnToPage === "settings" && returnToSection === "plans" && returnToPlanId
			? `/user=${encodeURIComponent(username)}/${encodeURIComponent(returnToPlanId)}/page=settings/plans`
			: undefined;
	const returnTo = returnToStructured ?? returnToLegacy;
	const requestedBudgetType: BudgetType = (
		typeProvided && isSupportedBudgetType(typeRaw)
			? typeRaw
			: hasPersonalPlan
				? "holiday"
				: "personal"
	) as BudgetType;
	const defaultBudgetType: BudgetType = hasPersonalPlan ? requestedBudgetType : "personal";

	const budgetTypeLabel =
		defaultBudgetType === "carnival"
			? "Carnival"
			: defaultBudgetType === "holiday"
				? "Holiday"
				: "Personal";

	return (
		<div className="min-h-screen app-theme-bg">
			<div className="relative mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-16">
				<div className="w-full">
					{returnTo ? (
						<Link href={returnTo} className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
							<ArrowLeft className="h-4 w-4" />
							<span>Back</span>
						</Link>
					) : null}
					<h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
						Create a {budgetTypeLabel} budget plan
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
