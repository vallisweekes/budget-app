"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, DollarSign, CreditCard, Target, Settings, Banknote } from "lucide-react";
import { currentMonthKey } from "@/lib/helpers/monthKey";

function parseUserScopedPath(pathname: string): { username: string; budgetPlanId: string } | null {
	const m = pathname.match(/^\/user=([^/]+)\/([^/]+)/);
	if (!m) return null;
	const username = decodeURIComponent(m[1] ?? "");
	const budgetPlanId = decodeURIComponent(m[2] ?? "");
	if (!username || !budgetPlanId) return null;
	return { username, budgetPlanId };
}

function parseUsernameFromUserScopedPath(pathname: string): string {
	const m = pathname.match(/^\/user=([^/]+)/);
	return decodeURIComponent(m?.[1] ?? "");
}

function isUserOnboardingNewBudget(pathname: string): boolean {
	if (!pathname.startsWith("/user=")) return false;
	const parts = pathname.split("/").filter(Boolean);
	return parts[2] === "budgets" && parts[3] === "new";
}

function getActiveUserPage(pathname: string): string {
	if (!pathname.startsWith("/user=")) return "";
	const parts = pathname.split("/").filter(Boolean);
	const pageSegment = parts[2] ?? "";
	if (!pageSegment || pageSegment === "dashboard") return "home";
	if (pageSegment === "admin") return (parts[3] ?? "").toLowerCase();
	if (pageSegment.toLowerCase().startsWith("page=")) {
		const key = pageSegment.slice("page=".length).toLowerCase();
		return key || "home";
	}
	return pageSegment.toLowerCase();
}

export default function MobileBottomNav() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const onboardingNewBudget = isUserOnboardingNewBudget(pathname);
	const returnToPlanId = (searchParams.get("returnToPlanId") ?? "").trim();
	const usernameFromPath = parseUsernameFromUserScopedPath(pathname);
	const scoped = onboardingNewBudget
		? returnToPlanId && usernameFromPath
			? { username: usernameFromPath, budgetPlanId: returnToPlanId }
			: null
		: parseUserScopedPath(pathname);
	const returnToPage = (searchParams.get("returnToPage") ?? "").trim().toLowerCase();
	const activePage = onboardingNewBudget && returnToPage ? returnToPage : getActiveUserPage(pathname);

	// Don't show on splash page
	if (pathname === "/") return null;

	const baseHref = scoped
		? `/user=${encodeURIComponent(scoped.username)}/${encodeURIComponent(scoped.budgetPlanId)}`
		: "/dashboard";

	const defaultYear = new Date().getFullYear();
	const defaultMonth = currentMonthKey();
	const expensesHref = `${baseHref}/page=expenses?year=${encodeURIComponent(String(defaultYear))}&month=${encodeURIComponent(
		defaultMonth
	)}`;

	const navItems: Array<{ key: string; href: string; label: string; icon: any }> = [
		{ key: "home", href: `${baseHref}/page=home`, label: "Home", icon: Home },
		{ key: "income", href: `${baseHref}/page=income`, label: "Income", icon: Banknote },
		{ key: "expenses", href: expensesHref, label: "Expenses", icon: DollarSign },
		{ key: "debts", href: `${baseHref}/page=debts`, label: "Debts", icon: CreditCard },
		{ key: "goals", href: `${baseHref}/page=goals`, label: "Goals", icon: Target },
	];

	return (
		<nav className="lg:hidden fixed bottom-4 left-4 right-4 z-30 flex justify-center pointer-events-none">
			<div className="pointer-events-auto bg-slate-900/30 backdrop-blur-2xl border border-white/20 rounded-full shadow-2xl px-4 py-3 ring-1 ring-white/5">
				<div className="flex items-center gap-2">
					{navItems.map((item) => {
						const active = activePage === item.key;
						
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`group flex items-center justify-center transition-all duration-300 ${
									active ? "text-white" : "text-slate-300 hover:text-white"
								}`}
							>
								<div
									className={`p-3 rounded-full transition-all duration-300 relative overflow-hidden ${
										active
											? "bg-blue-500/30 border border-blue-400/40 shadow-lg shadow-blue-500/20 scale-110"
											: "hover:bg-white/10 hover:scale-105 active:scale-95"
									}`}
								>
									{active && (
										<div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-cyan-500/20 animate-pulse" />
									)}
									<item.icon 
										size={20} 
										strokeWidth={active ? 2.5 : 2} 
										className={`relative z-10 transition-transform duration-300 ${
											active ? "text-white" : "text-slate-300 group-hover:text-white"
										}`} 
									/>
								</div>
							</Link>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
