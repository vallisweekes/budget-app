import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { resolveUserId } from "@/lib/budgetPlans";

export default async function NewBudgetPage({
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

	const sp = await searchParams;
	const raw = Array.isArray(sp.type) ? sp.type[0] : sp.type;
	const typeRaw = String(raw ?? "").trim().toLowerCase();
	const qs = typeRaw ? `?type=${encodeURIComponent(typeRaw)}` : "";
	const userId = await resolveUserId({ userId: sessionUser.id, username });

	redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(userId)}/budgets/new${qs}`);
}
