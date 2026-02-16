import { getServerSession } from "next-auth/next";
import Link from "next/link";
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
    
    const firstLetter = sessionUsername.charAt(0).toUpperCase();
    let countryFlag = FLAG_EMOJI.GB; // Default flag

    // Only fetch settings if budget plan exists
    if (budgetPlan) {
      const settings = await getSettings(budgetPlan.id);
      countryFlag = FLAG_EMOJI[settings.country] || FLAG_EMOJI.GB;
    }

    const settingsHref = budgetPlan 
      ? `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlan.id)}/page=settings`
      : "/settings";

    return (
      <Link href={settingsHref} className="fixed top-4 right-4 z-50 lg:hidden">
        <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {firstLetter}
          </div>
          <div className="text-lg leading-none" title={budgetPlan?.id ? "Country" : "Default"}>
            {countryFlag}
          </div>
        </div>
      </Link>
    );
  } catch (error) {
    console.error("AppHeader error:", error);
    // Still show header with defaults even on error
    const firstLetter = sessionUsername?.charAt(0).toUpperCase() || "?";
    return (
      <Link href="/settings" className="fixed top-4 right-4 z-50 lg:hidden">
        <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {firstLetter}
          </div>
          <div className="text-lg leading-none">{FLAG_EMOJI.GB}</div>
        </div>
      </Link>
    );
  }
}
