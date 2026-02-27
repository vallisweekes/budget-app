import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import LoginForm from "../LoginForm";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { getOnboardingForUser } from "@/lib/onboarding";

export default async function LoginPage(props: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const authParam = searchParams.auth;
  const authFlag = Array.isArray(authParam) ? authParam[0] : authParam;
  const showAuthMessage = authFlag === "1" || authFlag === "true";
  const modeParam = searchParams.mode;
  const modeRaw = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const initialMode = modeRaw === "register" ? "register" : "login";

  return (
    <div className="min-h-screen bg-[#0a0d14]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          BudgetIn Check
        </Link>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-6xl items-center px-4 pb-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-1/4 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="mx-auto w-full max-w-xl">
            <h1 className="text-5xl font-bold tracking-tight text-white md:text-6xl">
              Welcome back
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Log in to continue managing your budgets, upcoming payments, and goals.
            </p>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <LoginForm
              initialMode={initialMode}
              message={showAuthMessage ? "Please log in or register to continue." : undefined}
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[#070a12]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} BudgetIn Check</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms & Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
