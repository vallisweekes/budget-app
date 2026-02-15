"use client";

import Link from "next/link";
import { Home, Settings, DollarSign, CreditCard, Target, ShoppingBag, Banknote, LogOut } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
	// Supports both /<page> and /page=<page>
	const parts = pathname.split("/").filter(Boolean);
	const pageSegment = parts[2] ?? ""; // /user=<u>/<plan>/<page>
	if (!pageSegment || pageSegment === "dashboard") return "home";
	if (pageSegment === "admin") return (parts[3] ?? "").toLowerCase();
	if (pageSegment.toLowerCase().startsWith("page=")) {
		const key = pageSegment.slice("page=".length).toLowerCase();
		return key || "home";
	}
	return pageSegment.toLowerCase();
}

export default function Sidebar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { data: session } = useSession();
	const sessionUsername = session?.user?.username ?? session?.user?.name;

	const scoped = parseUserScopedPath(pathname);
	const planFromQuery = searchParams.get("plan")?.trim() || "";

	const baseHref = scoped
		? `/user=${encodeURIComponent(scoped.username)}/${encodeURIComponent(scoped.budgetPlanId)}`
		: sessionUsername && planFromQuery
			? `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(planFromQuery)}`
			: "/";
	const activePage = getActiveUserPage(pathname);
	const defaultYear = new Date().getFullYear();
	const defaultMonth = currentMonthKey();
	const expensesHref = `${baseHref}/page=expenses?year=${encodeURIComponent(String(defaultYear))}&month=${encodeURIComponent(
		defaultMonth
	)}`;

	const navItems: Array<{ key: string; href: string; label: string; icon: any }> = [
		{ key: "home", href: `${baseHref}/page=home`, label: "Home", icon: Home },
		...(pathname === "/artist" ? [{ key: "artist", href: "/artist", label: "Artist", icon: Target }] : []),
		{ key: "income", href: `${baseHref}/page=income`, label: "Income", icon: Banknote },
		{ key: "expenses", href: expensesHref, label: "Expenses", icon: DollarSign },
		{ key: "spending", href: `${baseHref}/page=spending`, label: "Spending", icon: ShoppingBag },
		{ key: "debts", href: `${baseHref}/page=debts`, label: "Debt", icon: CreditCard },
		{ key: "goals", href: `${baseHref}/page=goals`, label: "Goals", icon: Target },
		{ key: "settings", href: `${baseHref}/page=settings`, label: "Settings", icon: Settings },
	];

	const displayUsernameRaw = scoped?.username || sessionUsername || "";
	const displayUsername = displayUsernameRaw
		? displayUsernameRaw.slice(0, 1).toUpperCase() + displayUsernameRaw.slice(1)
		: "";

	return (
		<>
			{/* Sidebar - Desktop Only */}
			<aside className="hidden lg:block fixed top-0 left-0 h-full app-theme-bg bg-fixed border-r border-white/10 shadow-2xl z-40 w-72 xl:w-80">
				<div className="flex flex-col h-full p-6">
					{/* Logo/Title */}
					<div className="mb-8 mt-2">
						<div className="inline-flex items-center gap-3">
							<div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-white/10 shadow-lg" />
							<div>
								<h2 className="text-2xl font-bold text-white leading-none">
									Welcome{displayUsername ? ` ${displayUsername}` : ""}
								</h2>
								<p className="text-sm text-slate-400 mt-1">Manage your finances</p>
							</div>
						</div>
					</div>

					{/* Navigation */}
					<nav className="flex-1 space-y-2">
						{navItems.map((item) => (
							// Highlight based on the current page key (ignore query params)
							<Link
								key={item.href}
								href={item.href}
								className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
									activePage === item.key
										? "app-nav-active text-white shadow-sm"
										: "border-transparent text-slate-300 hover:bg-white/5 hover:border-white/10 hover:text-white"
								}`}
							>
								<item.icon size={20} className="text-slate-300 group-hover:text-white" />
								<span className="font-medium">{item.label}</span>
							</Link>
						))}
					</nav>

					{/* Footer */}
					<div className="pt-4 border-t border-white/10">
						<button
							onClick={() => signOut({ callbackUrl: "/" })}
							className="flex w-full items-center gap-3 px-4 py-3 rounded-xl border border-transparent transition-all text-slate-300 hover:bg-white/5 hover:border-white/10 hover:text-white"
						>
							<LogOut size={20} />
							<span className="font-medium">Log out</span>
						</button>
					</div>
				</div>
			</aside>
		</>
	);
}
