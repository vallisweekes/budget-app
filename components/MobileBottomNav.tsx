"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
	const scoped = parseUserScopedPath(pathname);
	const activePage = getActiveUserPage(pathname);

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
			<div className="pointer-events-auto bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl px-4 py-3">
				<div className="flex items-center gap-2">
					{navItems.map((item) => {
						const active = activePage === item.key;
						
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`group flex items-center justify-center transition-all ${
									active ? "text-white" : "text-slate-300 hover:text-white"
								}`}
							>
								<div
									className={`p-3 rounded-full transition-all ${
										active
											? "bg-blue-500/20 border border-blue-400/30"
											: "hover:bg-white/5"
									}`}
								>
									<item.icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-white" : "text-slate-300 group-hover:text-white"} />
								</div>
							</Link>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
