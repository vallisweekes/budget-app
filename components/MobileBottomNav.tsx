"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, CreditCard, Target, Banknote, ShoppingBag } from "lucide-react";
import { currentMonthKey } from "@/lib/helpers/monthKey";
import { getCurrencySymbol } from "@/lib/constants/locales";
import { DEFAULT_CURRENCY_CODE } from "@/lib/constants/money";

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
		if (key === "expense-category" || key.startsWith("expense-category")) return "expenses";
		return key || "home";
	}
	return pageSegment.toLowerCase();
}

export default function MobileBottomNav() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [currencyCode, setCurrencyCode] = useState<string>(DEFAULT_CURRENCY_CODE);
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

	useEffect(() => {
		if (!scoped?.budgetPlanId) return;
		const controller = new AbortController();
		(async () => {
			try {
				const res = await fetch(
					`/api/bff/settings?budgetPlanId=${encodeURIComponent(scoped.budgetPlanId)}`,
					{ signal: controller.signal, cache: "no-store" }
				);
				if (!res.ok) return;
				const body = (await res.json().catch(() => null)) as any;
				const next = typeof body?.currency === "string" ? body.currency.trim() : "";
				if (next) setCurrencyCode(next);
			} catch (e) {
				// Ignore network/auth errors; keep default currency.
				void e;
			}
		})();
		return () => controller.abort();
	}, [scoped?.budgetPlanId]);

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
		{ key: "expenses", href: expensesHref, label: "Expenses", icon: null },
		{ key: "spending", href: `${baseHref}/page=spending`, label: "Spending", icon: ShoppingBag },
		{ key: "debts", href: `${baseHref}/page=debts`, label: "Debts", icon: CreditCard },
		{ key: "goals", href: `${baseHref}/page=goals`, label: "Goals", icon: Target },
	];

	return (
		<nav className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+0.375rem)] left-4 right-4 z-30 flex justify-center pointer-events-none">
			<div className="pointer-events-auto w-[min(360px,calc(100vw-3rem))] bg-slate-900/30 backdrop-blur-2xl border border-white/20 rounded-full shadow-2xl px-3 sm:px-4 pt-2 pb-2 ring-1 ring-white/5">
				<div className="flex w-full items-center justify-between">
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
									className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all duration-300 relative overflow-hidden ${
										active
											? "bg-blue-500/30 border border-blue-400/40 shadow-lg shadow-blue-500/20 scale-105"
											: "hover:bg-white/10 hover:scale-105 active:scale-95"
									}`}
								>
									{active && (
										<div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-cyan-500/20 animate-pulse" />
									)}
									{item.key === "expenses" ? (
										<span
											aria-hidden="true"
											className={`relative z-10 block select-none text-[18px] leading-none font-semibold transition-transform duration-300 ${
												active ? "text-white" : "text-slate-300 group-hover:text-white"
											}`}
										>
											{getCurrencySymbol(currencyCode)}
										</span>
									) : (
										<item.icon
											size={17}
											strokeWidth={active ? 2.5 : 2}
											className={`relative z-10 transition-transform duration-300 ${
												active ? "text-white" : "text-slate-300 group-hover:text-white"
											} block`}
										/>
									)}
								</div>
							</Link>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
