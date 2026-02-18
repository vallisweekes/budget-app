"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { THEME_OPTIONS } from "@/components/Admin/Settings/theme";
import type { SettingsNavItem, SettingsSectionId, ThemeKey } from "@/types/components";

export default function SettingsSidebar({
	isHidden,
	theme,
	setTheme,
	sections,
	activeSectionId,
	onOpenSection,
}: {
	isHidden: boolean;
	theme: ThemeKey;
	setTheme: (next: ThemeKey) => void;
	sections: SettingsNavItem[];
	activeSectionId: SettingsSectionId;
	onOpenSection: (id: SettingsSectionId) => void;
}) {
	return (
		<aside
			className={`absolute inset-0 transition-all duration-300 ease-out transform-gpu overflow-y-auto pb-24 ${
				isHidden ? "opacity-0 -translate-x-6 pointer-events-none" : "opacity-100 translate-x-0"
			}`}
		>
			<div className="pt-16 lg:pt-6">
				<div className="mb-6">
					<div className="flex items-start justify-between gap-3 sm:gap-4 mb-4">
						<div className="flex-1">
							<h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">Settings</h1>
							<p className="text-slate-400 text-xs sm:text-lg">Configure your budget and app options</p>
						</div>
						<button
							type="button"
							onClick={() => signOut({ callbackUrl: "/" })}
							className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 border border-white/10 bg-white/5 hover:bg-white/10 transition"
						>
							<LogOut size={14} className="sm:w-4 sm:h-4" />
							Log out
						</button>
					</div>
				</div>

				<div className="mb-4 sm:mb-6 bg-slate-800/35 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 p-3 sm:p-5">
					<div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-white font-semibold text-sm sm:text-base">Theme preview</p>
							<p className="text-slate-300 text-xs sm:text-sm">Try a few vibes and pick your favourite.</p>
						</div>
						<div className="flex items-center gap-2 sm:gap-3">
							<select
								value={theme}
								onChange={(e) => setTheme(e.target.value as ThemeKey)}
								className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
								aria-label="Theme preview"
							>
								{THEME_OPTIONS.map((t) => (
									<option key={t.value} value={t.value}>
										{t.label}
									</option>
								))}
							</select>
						</div>
					</div>
					<p className="text-xs text-slate-400 mt-3">{THEME_OPTIONS.find((t) => t.value === theme)?.description}</p>
				</div>

				<div className="bg-slate-800/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 p-3 sm:p-4">
					<nav className="space-y-0.5 sm:space-y-1">
						{sections.map((s) => {
							const Icon = s.icon;
							return (
								<button
									key={s.id}
									onClick={() => onOpenSection(s.id)}
									className={`w-full text-left flex items-center gap-2 sm:gap-3 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 transition ${
										activeSectionId === s.id
											? "bg-blue-500/20 border-blue-500/50 text-white"
											: "text-slate-200 hover:bg-white/5 border-transparent hover:border-white/10"
									} border`}
								>
									<Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									<div className="flex-1">
										<div className="text-xs sm:text-sm font-semibold">{s.title}</div>
										<div className="text-[10px] sm:text-xs text-slate-400">{s.description}</div>
									</div>
								</button>
							);
						})}
					</nav>
				</div>
			</div>
		</aside>
	);
}
