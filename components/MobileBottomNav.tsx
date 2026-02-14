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

export default function MobileBottomNav() {
	const pathname = usePathname();
	const scoped = parseUserScopedPath(pathname);

	// Don't show on splash page
	if (pathname === "/") return null;

	const baseHref = scoped
		? `/user=${encodeURIComponent(scoped.username)}/${encodeURIComponent(scoped.budgetPlanId)}`
		: "/dashboard";

	const defaultYear = new Date().getFullYear();
	const defaultMonth = currentMonthKey();
	const expensesHref = `${baseHref}/expenses?year=${encodeURIComponent(String(defaultYear))}&month=${encodeURIComponent(
		defaultMonth
	)}`;

	const navItems = [
		{ href: baseHref, label: "Home", icon: Home },
		{ href: `${baseHref}/income`, label: "Income", icon: Banknote },
		{ href: expensesHref, label: "Expenses", icon: DollarSign },
		{ href: `${baseHref}/debts`, label: "Debts", icon: CreditCard },
		{ href: `${baseHref}/goals`, label: "Goals", icon: Target },
		{ href: `${baseHref}/settings`, label: "Settings", icon: Settings },
	];

	const isActive = (href: string) => {
		const pathOnly = href.split("?")[0] ?? href;
		if (href === baseHref) {
			return pathname === href || pathname === `${href}/`;
		}
		return pathname.startsWith(pathOnly);
	};

	return (
		<nav className="lg:hidden fixed bottom-0 left-0 right-0 app-theme-bg bg-fixed border-t border-white/10 shadow-2xl z-30 safe-area-inset-bottom">
			<div className="flex items-center justify-around px-2 py-3">
				{navItems.map((item) => {
					const active = isActive(item.href);
					
					return (
						<Link
							key={item.href}
							href={item.href}
							className={`group flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[64px] ${
								active ? "text-white" : "text-slate-300 hover:text-white"
							}`}
						>
							<div
								className={`p-2 rounded-lg border transition-all ${
									active
										? "app-nav-active"
										: "border-transparent group-hover:bg-white/5 group-hover:border-white/10"
								}`}
							>
								<item.icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-white" : "text-slate-300 group-hover:text-white"} />
							</div>
							<span className="text-xs font-medium">{item.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
