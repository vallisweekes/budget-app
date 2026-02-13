"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Home, Settings, DollarSign, CreditCard, Target, ShoppingBag, Banknote, LogOut } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { SelectDropdown } from "@/components/Shared";

function parseUserScopedPath(pathname: string): { username: string; budgetPlanId: string } | null {
	const m = pathname.match(/^\/user=([^/]+)\/([^/]+)/);
	if (!m) return null;
	const username = decodeURIComponent(m[1] ?? "");
	const budgetPlanId = decodeURIComponent(m[2] ?? "");
	if (!username || !budgetPlanId) return null;
	return { username, budgetPlanId };
}

export default function Sidebar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const { data: session } = useSession();
	const sessionUsername = session?.user?.username ?? session?.user?.name;
	const [plans, setPlans] = useState<Array<{ id: string; name: string; kind: string }>>([]);

	const scoped = parseUserScopedPath(pathname);
	const planFromQuery = searchParams.get("plan")?.trim() || "";
	const currentPlanId = scoped?.budgetPlanId || planFromQuery;

	useEffect(() => {
		if (!sessionUsername) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/bff/budget-plans", { cache: "no-store" });
				if (!res.ok) return;
				const data = (await res.json()) as { plans?: Array<{ id: string; name: string; kind: string }> };
				if (cancelled) return;
				setPlans(Array.isArray(data.plans) ? data.plans : []);
			} catch {
				// Non-blocking: sidebar still works without the switcher.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionUsername]);

	const planOptions = useMemo(
		() =>
			plans.map((p) => ({
				value: p.id,
				label: `${p.name} (${p.kind})`,
			})),
		[plans]
	);

	const baseHref = scoped
		? `/user=${encodeURIComponent(scoped.username)}/${encodeURIComponent(scoped.budgetPlanId)}`
		: sessionUsername && planFromQuery
			? `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(planFromQuery)}`
			: "/";

	const tailPath = scoped ? pathname.replace(/^\/user=[^/]+\/[^/]+/, "") : "";
	const qs = searchParams.toString();

	const navItems = [
		{ href: baseHref, label: "Home", icon: Home },
		...(pathname === "/artist" ? [{ href: "/artist", label: "Artist", icon: Target }] : []),
		{ href: `${baseHref}/income`, label: "Income", icon: Banknote },
		{ href: `${baseHref}/expenses`, label: "Expenses", icon: DollarSign },
		{ href: `${baseHref}/spending`, label: "Spending", icon: ShoppingBag },
		{ href: `${baseHref}/debts`, label: "Debt", icon: CreditCard },
		{ href: `${baseHref}/goals`, label: "Goals", icon: Target },
		{ href: `${baseHref}/settings`, label: "Settings", icon: Settings },
	];

	return (
		<>
			{/* Sidebar - Desktop Only */}
			<aside className="hidden lg:block fixed top-0 left-0 h-full bg-slate-900/95 backdrop-blur-xl border-r border-white/10 shadow-2xl z-40 w-64">
				<div className="flex flex-col h-full p-6">
					{/* Logo/Title */}
					<div className="mb-8 mt-2">
						<h2 className="text-2xl font-bold text-white">
							Budget App
						</h2>
						<p className="text-sm text-slate-400 mt-1">Manage your finances</p>
					</div>

					{/* Navigation */}
					<nav className="flex-1 space-y-2">
						{navItems.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
									pathname === item.href
										? "bg-white/10 text-white font-semibold backdrop-blur-sm"
										: "text-slate-400 hover:bg-white/5 hover:text-white"
								}`}
							>
								<item.icon size={20} />
								<span className="font-medium">{item.label}</span>
							</Link>
						))}
					</nav>

					{/* Footer */}
					<div className="pt-4 border-t border-white/10">
						<button
							onClick={() => signOut({ callbackUrl: "/" })}
							className="flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-white/5 hover:text-white"
						>
							<LogOut size={20} />
							<span className="font-medium">Log out</span>
						</button>
						<p className="text-xs text-slate-500 text-center mt-4">
							Budget App v1.0
						</p>
					</div>
				</div>
			</aside>
		</>
	);
}
