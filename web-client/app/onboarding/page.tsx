import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { getOnboardingForUser } from "@/lib/onboarding";
import OnboardingWizard from "./OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const username = sessionUser?.username ?? sessionUser?.name ?? "";

  if (!sessionUser || !username) {
    redirect("/");
  }

  const userId = await resolveUserId({ userId: sessionUser.id, username });
  const onboarding = await getOnboardingForUser(userId);

  if (!onboarding.required) {
    const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username });
    if (!budgetPlan) {
      redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(userId)}/budgets/new`);
    }
    redirect(`/user=${encodeURIComponent(username)}/${encodeURIComponent(budgetPlan.id)}/page=home`);
  }

  return <OnboardingWizard username={username} initial={onboarding} />;
}
