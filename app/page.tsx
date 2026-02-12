import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { authOptions } from "@/lib/auth";

export default async function LoginSplashPage() {
	const session = await getServerSession(authOptions);
	const username = session?.user?.username ?? session?.user?.name ?? "";
	const budgetPlanId = session?.user?.budgetPlanId;
	const budgetType = session?.user?.budgetType ?? "personal";

	if (username && budgetPlanId) {
		redirect(`/user=${encodeURIComponent(username)}/id/${encodeURIComponent(budgetPlanId)}`);
	}
	if (username) {
		redirect("/dashboard");
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-xl px-4 py-16">
				<h1 className="text-3xl font-bold text-white">Budget App</h1>
				<p className="mt-2 text-slate-300">Log in to choose a budget space.</p>
				<LoginForm />
			</div>
		</div>
	);
}



