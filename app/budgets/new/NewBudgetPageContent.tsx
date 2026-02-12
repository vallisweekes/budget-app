import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, isSupportedBudgetType } from "@/lib/budgetPlans";
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

	// If they already have a budget, send them to it (they can add more later via UI).
	const existing = await getDefaultBudgetPlanForUser({ userId: sessionUser.id, username });
	if (existing) {
		redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(existing.id)}`);
	}

	const sp = await searchParams;
	const raw = Array.isArray(sp.type) ? sp.type[0] : sp.type;
	const typeRaw = String(raw ?? "personal").trim().toLowerCase();
	const defaultBudgetType: BudgetType = (isSupportedBudgetType(typeRaw) ? typeRaw : "personal") as BudgetType;

	return (
		<div className="min-h-screen bg-[#0a0d14]">
			<div className="relative mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-16">
				<div className="w-full">
					<div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
						<span className="h-2 w-2 rounded-full bg-blue-400" />
						Create budget
					</div>
					<h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
						Choose your first budget type
					</h1>
					<p className="mt-3 text-slate-300">
						You’re signed in as <span className="font-semibold text-slate-200">{username}</span>. Let’s create your first budget.
					</p>

					<CreateBudgetForm action={createBudgetPlanAction} defaultBudgetType={defaultBudgetType} />
				</div>
			</div>
		</div>
	);
}
