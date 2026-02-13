"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, DollarSign, CreditCard, Target, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

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
	const searchParams = useSearchParams();
	const scoped = parseUserScopedPath(pathname);
	const planFromQuery = searchParams.get("plan")?.trim() || "";

	// Don't show on splash page
	if (pathname === "/") return null;

	const baseHref = scoped
		? `/user=${encodeURIComponent(scoped.username)}/${encodeURIComponent(scoped.budgetPlanId)}`
		: "/dashboard";

	const navItems = [
		{ href: baseHref, label: "Home", icon: Home },
		{ href: `${baseHref}/expenses`, label: "Expenses", icon: DollarSign },
		{ href: `${baseHref}/debts`, label: "Debts", icon: CreditCard },
		{ href: `${baseHref}/goals`, label: "Goals", icon: Target },
		{ href: `${baseHref}/settings`, label: "Settings", icon: Settings },
		{ href: "#", label: "Logout", icon: LogOut, action: () => signOut({ callbackUrl: "/" }) },
	];

	const isActive = (href: string) => {
		if (href === baseHref) {
			return pathname === href || pathname === `${href}/`;
		}
		return pathname.startsWith(href);
	};

	return (
		<nav className="lg:hidden fixed bottom-0 left-0 right-0 app-theme-bg bg-fixed border-t border-white/10 shadow-2xl z-30 safe-area-inset-bottom">
			<div className="flex items-center justify-around px-2 py-3">
				{navItems.map((item) => {
					const active = isActive(item.href);
					
					if (item.action) {
						return (
							<button
								key={item.label}
								onClick={item.action}
								className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[64px] text-slate-300 hover:text-red-400"
							>
								<div className="p-2 rounded-lg transition-all hover:bg-red-500/10">
									<item.icon size={20} strokeWidth={2} />
								</div>
								<span className="text-xs font-medium">{item.label}</span>
							</button>
						);
					}
					
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
										? "bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border-teal-400/30"
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
