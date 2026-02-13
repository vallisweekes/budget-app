import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDefaultBudgetPlanForUser, resolveUserId } from "@/lib/budgetPlans";
import { getSettings } from "@/lib/settings/store";

const FLAG_EMOJI: Record<string, string> = {
  GB: "🇬🇧",
  US: "🇺🇸",
  DE: "🇩🇪",
  FR: "🇫🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
};

export default async function AppHeader() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sessionUser = session.user;
  const sessionUsername = sessionUser?.username ?? sessionUser?.name;
  if (!sessionUsername) return null;

  try {
    const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
    const budgetPlan = await getDefaultBudgetPlanForUser({ userId, username: sessionUsername });
    
    if (!budgetPlan) return null;

    const settings = await getSettings(budgetPlan.id);
    const firstLetter = sessionUsername.charAt(0).toUpperCase();
    const countryFlag = FLAG_EMOJI[settings.country] || FLAG_EMOJI.GB;

    return (
      <header className="h-12 bg-gradient-to-r from-blue-950 via-slate-950 to-slate-900 backdrop-blur-xl border-b border-white/10 flex items-center justify-end px-4 lg:px-6 fixed top-0 left-0 right-0 z-50 lg:left-64">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {firstLetter}
          </div>
          <div className="text-lg leading-none" title={settings.country}>
            {countryFlag}
          </div>
        </div>
      </header>
    );
  } catch (error) {
    return null;
  }
}
