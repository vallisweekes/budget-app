"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONTHS } from "@/lib/constants/time";
import { SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, SUPPORTED_LANGUAGES } from "@/lib/constants/locales";
import { InfoTooltip, SelectDropdown } from "@/components/Shared";
import type { MonthKey } from "@/types";
import { ArrowLeft, CalendarDays, Lightbulb, PiggyBank, Wallet, Globe, User, AlertTriangle, Edit2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { applyFiftyThirtyTwentyTargetsAction, saveSettingsAction, updateUserDetailsAction } from "./actions";
import DeleteBudgetPlanButton from "./DeleteBudgetPlanButton";
import type { Settings } from "@/lib/settings/store";
import CreateBudgetForm, { type BudgetType } from "@/app/budgets/new/CreateBudgetForm";

type Section = "details" | "budget" | "locale" | "plans" | "danger";

type MonthSummary = {
	year: number;
	unallocated: number;
	incomeTotal: number;
	expenseTotal: number;
	debtPaymentsTotal: number;
	spendingTotal: number;
	plannedSavings: number;
	plannedEmergency: number;
	plannedInvestments: number;
};

type FiftyThirtyTwentySummary = {
	needsTarget: number;
	needsActual: number;
	wantsTarget: number;
	wantsActual: number;
	savingsDebtTarget: number;
	savingsDebtActual: number;
};

type ThemeKey = "nord-mint" | "calm-teal" | "midnight-peach" | "soft-light";

const THEME_OPTIONS: Array<{ value: ThemeKey; label: string; description: string }> = [
	{ value: "nord-mint", label: "Nord Mint", description: "Minimal, premium, muted" },
	{ value: "calm-teal", label: "Calm Teal", description: "Modern, calm, slightly fintech" },
	{ value: "midnight-peach", label: "Midnight + Peach", description: "Friendly, energetic, not corporate" },
	{ value: "soft-light", label: "Soft Light", description: "Bright, everyday, lifestyle" },
];

interface SettingsContentProps {
	budgetPlanId: string;
	settings: Settings;
	sessionUser: { id?: string; name?: string | null; email?: string | null };
	monthSummary: MonthSummary | null;
	fiftyThirtyTwenty: FiftyThirtyTwentySummary | null;
	selectedMonth: MonthKey;
	allPlans?: Array<{ id: string; name: string; kind: string }>;
	createBudgetPlanAction?: (formData: FormData) => void;
}

export default function SettingsContent({
	budgetPlanId,
	settings,
	sessionUser,
	monthSummary,
	fiftyThirtyTwenty,
	selectedMonth,
	allPlans = [],
	createBudgetPlanAction,
}: SettingsContentProps) {
	const searchParams = useSearchParams();
	const applied = searchParams?.get("applied") ?? "";
	const [showApply503020, setShowApply503020] = useState(false);
	const [isEditingPayDate, setIsEditingPayDate] = useState(false);
	const [activeSection, setActiveSection] = useState<Section>("details");
	const [mobileView, setMobileView] = useState<"menu" | "content">("menu");
	const [isEditingEmail, setIsEditingEmail] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const [theme, setTheme] = useState<ThemeKey>(() => {
		if (typeof document === "undefined") return "nord-mint";
		const raw = document.documentElement.dataset.theme;
		if (raw === "midnight-peach" || raw === "nord-mint" || raw === "soft-light" || raw === "calm-teal") return raw;
		return "nord-mint";
	});

	const hasPersonalPlan = useMemo(() => {
		return allPlans.some((p) => String(p.kind).toLowerCase() === "personal");
	}, [allPlans]);

	const payDateLabel = useMemo(() => {
		const d = Math.max(1, Math.min(31, Number(settings.payDate ?? 1)));
		const mod10 = d % 10;
		const mod100 = d % 100;
		const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
		return `${d}${suffix}`;
	}, [settings.payDate]);

	useEffect(() => {
		try {
			document.documentElement.dataset.theme = theme;
			localStorage.setItem("theme", theme);
		} catch {
			// Non-blocking; theme preview just won't persist.
		}
	}, [theme]);

	const sections = [
		{
			id: "details" as Section,
			title: "My Details",
			description: "Your personal information",
			icon: User,
		},
		{
			id: "budget" as Section,
			title: "Budget",
			description: "Core settings for your monthly budgeting",
			icon: PiggyBank,
		},
		{
			id: "locale" as Section,
			title: "Locale",
			description: "Country, language, and currency preferences",
			icon: Globe,
		},
		{
			id: "plans" as Section,
			title: "Plans",
			description: "Manage your budget plans",
			icon: Wallet,
		},
		{
			id: "danger" as Section,
			title: "Danger Zone",
			description: "Irreversible actions",
			icon: AlertTriangle,
		},
	];

	const SECTION_TO_SLUG: Record<Section, string> = {
		details: "my-details",
		budget: "budget",
		locale: "locale",
		plans: "plans",
		danger: "danger-zone",
	};
	const SLUG_TO_SECTION: Record<string, Section> = {
		"my-details": "details",
		budget: "budget",
		locale: "locale",
		plans: "plans",
		"danger-zone": "danger",
	};

	const isContentView = mobileView === "content";

	const getSettingsBasePath = (path: string) => {
		const parts = path.split("/").filter(Boolean);
		const idx = parts.findIndex((p) => p === "page=settings" || p === "settings");
		if (idx === -1) return path;
		return `/${parts.slice(0, idx + 1).join("/")}`;
	};

	const getSectionFromPath = (path: string): Section | null => {
		const parts = path.split("/").filter(Boolean);
		const idx = parts.findIndex((p) => p === "page=settings" || p === "settings");
		if (idx === -1) return null;
		const slug = parts[idx + 1];
		if (!slug) return null;
		return SLUG_TO_SECTION[slug] ?? null;
	};

	const settingsBasePath = getSettingsBasePath(pathname);
	const typeParamRaw = (searchParams.get("type") ?? "").trim().toLowerCase();
	const requestedType: BudgetType = (typeParamRaw === "holiday" || typeParamRaw === "carnival" || typeParamRaw === "personal"
		? (typeParamRaw as BudgetType)
		: "personal");
	const isPlansNewRoute = useMemo(() => {
		const parts = pathname.split("/").filter(Boolean);
		const idx = parts.findIndex((p) => p === "page=settings" || p === "settings");
		if (idx === -1) return false;
		return parts[idx + 1] === "plans" && parts[idx + 2] === "new";
	}, [pathname]);

	const createDefaultType: BudgetType = hasPersonalPlan
		? requestedType === "personal" && !typeParamRaw
			? "holiday"
			: requestedType
		: "personal";

	useEffect(() => {
		const section = getSectionFromPath(pathname);
		if (section) {
			setActiveSection(section);
			setMobileView("content");
		} else {
			setMobileView("menu");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	const openSection = (section: Section) => {
		setActiveSection(section);
		setMobileView("content");
		const next = `${settingsBasePath}/${SECTION_TO_SLUG[section]}`;
		router.push(next, { scroll: false });
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			// Non-blocking
		}
	};

	const backToMenu = () => {
		setMobileView("menu");
		router.push(settingsBasePath, { scroll: false });
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			// Non-blocking
		}
	};

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
				{/* Settings: menu -> section (all breakpoints) */}
				<div className="relative overflow-hidden min-h-[calc(100vh-6rem)]">
					<aside
						className={`absolute inset-0 transition-all duration-300 ease-out transform-gpu overflow-y-auto pb-24 ${
							isContentView ? "opacity-0 -translate-x-6 pointer-events-none" : "opacity-100 translate-x-0"
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
								<p className="text-xs text-slate-400 mt-3">
									{THEME_OPTIONS.find((t) => t.value === theme)?.description}
								</p>
							</div>

							<div className="bg-slate-800/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 p-3 sm:p-4">
								<nav className="space-y-0.5 sm:space-y-1">
									{sections.map((s) => {
										const Icon = s.icon;
										return (
											<button
												key={s.id}
												onClick={() => openSection(s.id)}
												className={`w-full text-left flex items-center gap-2 sm:gap-3 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 transition ${
													activeSection === s.id
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

					<main
						className={`absolute inset-0 transition-all duration-300 ease-out transform-gpu overflow-y-auto pb-24 ${
							isContentView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none"
						}`}
					>
						<div className="pt-16 lg:pt-6 mb-4">
							<button
								type="button"
								onClick={backToMenu}
								className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition"
								aria-label="Back to settings"
							>
								<ArrowLeft className="w-4 h-4" />
								<span>Settings</span>
							</button>
						</div>

						{activeSection === "details" && (
						<section className="space-y-4 sm:space-y-6">
							<div className="flex items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
								<div>
									<h2 className="text-xl sm:text-2xl font-bold text-white">My Details</h2>
									<p className="text-slate-400 text-xs sm:text-sm">Your personal information</p>
								</div>
							</div>

							<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 p-4 sm:p-8">
								<form action={updateUserDetailsAction} className="space-y-4 sm:space-y-6">
										<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
										<div>
											<label className="block text-sm font-medium text-slate-400 mb-2">Name</label>
											<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-400 text-lg">
												{sessionUser.name || "Not set"}
											</div>
											<p className="text-xs text-slate-500 mt-1">Name is set by your authentication provider</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
											<div className="relative">
												{isEditingEmail ? (
													<input
														name="email"
														type="email"
														defaultValue={sessionUser.email || ""}
														placeholder="your@email.com"
														className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 pr-12 text-white text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
													/>
												) : (
													<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 pr-12 text-white text-lg">
														{sessionUser.email || "Not set"}
													</div>
												)}
												<button
													type="button"
													onClick={() => setIsEditingEmail(!isEditingEmail)}
													className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors"
													aria-label={isEditingEmail ? "Cancel editing" : "Edit email"}
												>
													<Edit2 className="w-4 h-4 text-slate-400" />
												</button>
											</div>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-400 mb-2">Country</label>
											<SelectDropdown
												name="country"
												defaultValue={settings.country ?? "GB"}
												options={SUPPORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
												buttonClassName="bg-slate-900/60 focus:ring-blue-500"
											/>
										</div>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Details
										</button>
									</form>
								</div>
							</section>
						)}

						{activeSection === "budget" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Budget</h2>
										<p className="text-slate-400 text-sm">Pay date, horizon, and budgeting style.</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
											Core
										</span>
									</div>
								</div>

								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
										<div className="flex items-center gap-3 mb-6">
											<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
												<CalendarDays className="w-5 h-5 text-slate-200" />
											</div>
											<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
												Pay Date
												<InfoTooltip
													ariaLabel="Pay date info"
													content="The day of the month you typically get paid. Used as a default for due dates and monthly planning."
												/>
											</h3>
										</div>
										{!isEditingPayDate ? (
											<div className="space-y-4">
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4">
													<p className="text-xs font-medium text-slate-400">Current pay date</p>
													<p className="mt-1 text-2xl font-extrabold text-white">{payDateLabel}</p>
													<p className="mt-2 text-xs text-slate-500">Locked to prevent accidental changes.</p>
												</div>
												<button
													type="button"
													onClick={() => setIsEditingPayDate(true)}
													className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
												>
												Change pay date
											</button>
										</div>
										) : (
											<form
												action={saveSettingsAction}
												onSubmit={() => setIsEditingPayDate(false)}
												className="space-y-4"
											>
												<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
												<label className="block">
													<span className="text-sm font-medium text-slate-400 mb-2 block">Day of Month</span>
													<input
														name="payDate"
														type="number"
														min={1}
														max={31}
														inputMode="numeric"
														defaultValue={settings.payDate}
														onWheel={(e) => {
															// Prevent accidental scroll-wheel changes.
															(e.currentTarget as HTMLInputElement).blur();
														}}
														className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
													/>
												</label>
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={() => setIsEditingPayDate(false)}
														className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
													>
														Cancel
													</button>
													<button
														type="submit"
														className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
													>
														Save
													</button>
												</div>
											</form>
										)}
									</div>

										<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
											<div className="flex items-center gap-3 mb-6">
												<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
													<CalendarDays className="w-5 h-5 text-slate-200" />
												</div>
												<div>
													<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
														Budget horizon
														<InfoTooltip
															ariaLabel="Budget horizon info"
															content="Choose how many years ahead this plan covers."
														/>
													</h3>
													<p className="text-slate-400 text-sm">Select how far ahead you plan.</p>
												</div>
											</div>

											<form action={saveSettingsAction} className="flex flex-col md:flex-row md:items-end gap-4">
												<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
												<label className="block md:flex-1">
													<span className="text-sm font-medium text-slate-400 mb-2 block">Years</span>
													<SelectDropdown
														name="budgetHorizonYears"
														defaultValue={String(settings.budgetHorizonYears ?? 10)}
														options={[2, 5, 10, 15, 20, 25, 30].map((n) => ({ value: String(n), label: `${n} years` }))}
														buttonClassName="bg-slate-900/60 focus:ring-blue-500"
													/>
												</label>
												<button
													type="submit"
													className="w-full md:w-40 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
												>
													Save
												</button>
											</form>
										</div>

								</div>

								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
									<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
										<div className="flex items-center gap-3 mb-6">
											<div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
												<Lightbulb className="w-5 h-5 text-slate-200" />
											</div>
											<div>
												<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
													Budget Strategy
													<InfoTooltip
														ariaLabel="Budget strategy info"
														content="Choose a budgeting style (e.g. zero-based, 50/30/20) to enable extra guidance and summaries."
													/>
												</h3>
												<p className="text-slate-400 text-sm">Optional. Turn on features like zero-based budgeting.</p>
											</div>
										</div>
										<form action={saveSettingsAction} className="space-y-4">
											<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Strategy</span>
												<SelectDropdown
													name="budgetStrategy"
													defaultValue={settings.budgetStrategy ?? ""}
													options={[
														{ value: "", label: "None" },
														{ value: "zeroBased", label: "Zero-based budgeting (ZBB)" },
														{ value: "fiftyThirtyTwenty", label: "50/30/20 rule" },
														{ value: "payYourselfFirst", label: "Pay yourself first" },
													]}
													buttonClassName="bg-slate-900/60 focus:ring-pink-500"
												/>
											</label>
											<button
												type="submit"
												className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
											>
												Save Strategy
											</button>
										</form>
									</div>

									{settings.budgetStrategy === "zeroBased" && monthSummary && (
										<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
											<div className="flex items-start justify-between gap-4 mb-6">
												<div>
													<h3 className="text-xl font-bold text-white inline-flex items-center gap-2">
														Zero-based leftover
														<InfoTooltip
															ariaLabel="Zero-based leftover info"
															content="Shows what’s still unallocated for the selected month."
														/>
													</h3>
													{/* Intentionally no subtitle here; tooltip explains it. */}
												</div>
												<form method="get" className="flex items-end gap-2">
													<label className="block">
														<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
														<SelectDropdown
															name="month"
															defaultValue={selectedMonth}
															options={MONTHS.map((m) => ({ value: m, label: m }))}
															buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
														/>
													</label>
													<button
														type="submit"
														className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
													>
														View
													</button>
												</form>
											</div>

											<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
												<div className="flex items-center justify-between gap-4">
													<div>
														<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Leftover to allocate</p>
														<p className="text-3xl font-extrabold text-white mt-1">£{monthSummary.unallocated.toFixed(2)}</p>
														<p className="text-xs text-slate-500 mt-2">Previewing: {selectedMonth} {monthSummary.year}</p>
													</div>
													<div className="text-right">
														<p className="text-slate-300 text-sm font-semibold">Tip</p>
														<p className="text-slate-400 text-sm">
															Adjust Allowance / Savings / Investments until this is £0.
														</p>
													</div>
												</div>
												<p className="text-xs text-slate-500 mt-3">
													Leftover = Income − Expenses − Debt Payments − Allowance − Savings − Investments
												</p>
											</div>

											<div className="grid grid-cols-2 gap-3 text-sm">
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Income</p>
													<p className="text-white font-bold">£{monthSummary.incomeTotal.toFixed(2)}</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Expenses</p>
													<p className="text-white font-bold">£{monthSummary.expenseTotal.toFixed(2)}</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Debt payments</p>
													<p className="text-white font-bold">£{monthSummary.debtPaymentsTotal.toFixed(2)}</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Spending (tracked)</p>
													<p className="text-white font-bold">£{monthSummary.spendingTotal.toFixed(2)}</p>
												</div>
											</div>
										</div>
									)}

									{settings.budgetStrategy === "fiftyThirtyTwenty" && monthSummary && fiftyThirtyTwenty && (
										<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
											<div className="flex items-start justify-between gap-4 mb-6">
												<div>
													<h3 className="text-xl font-bold text-white">50/30/20 targets</h3>
													<p className="text-slate-400 text-sm">Simple guideline based on your income for the month.</p>
												</div>
												<form method="get" className="flex items-end gap-2">
													<label className="block">
														<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
														<SelectDropdown
															name="month"
															defaultValue={selectedMonth}
															options={MONTHS.map((m) => ({ value: m, label: m }))}
															buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
														/>
													</label>
													<button
														type="submit"
														className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
													>
														View
													</button>
												</form>
											</div>

											<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
												<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Income used for targets</p>
												<p className="text-2xl font-extrabold text-white mt-1">£{monthSummary.incomeTotal.toFixed(2)}</p>
												<p className="text-xs text-slate-500 mt-2">Previewing: {selectedMonth} {monthSummary.year}</p>
												<p className="text-xs text-slate-500 mt-2">
													Needs and wants are approximations until category tagging is added.
												</p>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
													<p className="text-slate-300 font-semibold">Needs (50%)</p>
													<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.needsTarget.toFixed(2)}</p>
													<p className="text-slate-400 text-sm mt-1">
														Actual (expenses): £{fiftyThirtyTwenty.needsActual.toFixed(2)}
													</p>
													<p className="text-slate-500 text-xs mt-1">
														Delta: £{(fiftyThirtyTwenty.needsActual - fiftyThirtyTwenty.needsTarget).toFixed(2)}
													</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
													<p className="text-slate-300 font-semibold">Wants (30%)</p>
													<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.wantsTarget.toFixed(2)}</p>
													<p className="text-slate-400 text-sm mt-1">
														Actual (allowance): £{fiftyThirtyTwenty.wantsActual.toFixed(2)}
													</p>
													<p className="text-slate-500 text-xs mt-1">
														Delta: £{(fiftyThirtyTwenty.wantsActual - fiftyThirtyTwenty.wantsTarget).toFixed(2)}
													</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
													<p className="text-slate-300 font-semibold">Savings/Debt (20%)</p>
													<p className="text-white font-bold mt-1">Target: £{fiftyThirtyTwenty.savingsDebtTarget.toFixed(2)}</p>
													<p className="text-slate-400 text-sm mt-1">
														Actual (savings + investments + debt): £{fiftyThirtyTwenty.savingsDebtActual.toFixed(2)}
													</p>
													<p className="text-slate-500 text-xs mt-1">
														Delta: £{(fiftyThirtyTwenty.savingsDebtActual - fiftyThirtyTwenty.savingsDebtTarget).toFixed(2)}
													</p>
												</div>
											</div>

											{applied === "503020" ? (
												<div className="mt-5 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-4">
													<div className="text-sm font-semibold text-emerald-200">Applied 50/30/20 targets for {selectedMonth} {monthSummary.year}.</div>
													<div className="text-xs text-emerald-200/80 mt-1">Allowance and Savings were updated for this month.</div>
												</div>
											) : null}

											<div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
												<div className="text-sm font-semibold text-white">Apply these targets to your budget</div>
												<div className="text-xs text-slate-400 mt-1">
													Writes a monthly override for {selectedMonth} {monthSummary.year}. Uses your debt plan amounts (from Debts) when calculating the 20% bucket.
												</div>

												{!showApply503020 ? (
													<button
														type="button"
														onClick={() => setShowApply503020(true)}
														className="mt-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
													>
														Preview + Apply
													</button>
												) : (
													<div className="mt-3 flex items-center gap-2">
														<button
															type="button"
															onClick={() => setShowApply503020(false)}
															className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
														>
															Cancel
														</button>
														<form action={applyFiftyThirtyTwentyTargetsAction}>
															<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
															<input type="hidden" name="month" value={selectedMonth} />
															<input type="hidden" name="year" value={monthSummary.year} />
															<button
																type="submit"
																className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
															>
																Apply now
															</button>
														</form>
													</div>
												)}
											</div>

											{showApply503020 ? (
												<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
													<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
														<p className="text-slate-400">Allowance (30% target)</p>
														<p className="text-white font-bold">£{fiftyThirtyTwenty.wantsTarget.toFixed(2)}</p>
														<p className="text-xs text-slate-500 mt-1">This will set your monthly allowance override to match the 30% guideline.</p>
													</div>
													<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
														<p className="text-slate-400">Savings/Debt (20% target)</p>
														<p className="text-white font-bold">£{fiftyThirtyTwenty.savingsDebtTarget.toFixed(2)}</p>
														<p className="text-xs text-slate-500 mt-1">
															This will adjust your Savings contribution for the month (keeping Emergency + Investments as-is) so that Savings + Emergency + Investments + planned debt ≈ 20% of income.
														</p>
													</div>
												</div>
											) : null}
										</div>
									)}

									{settings.budgetStrategy === "payYourselfFirst" && monthSummary && (
										<div className="rounded-2xl sm:rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl p-5 sm:p-7 shadow-xl">
											<div className="flex items-start justify-between gap-4 mb-6">
												<div>
													<h3 className="text-xl font-bold text-white">Pay yourself first</h3>
													<p className="text-slate-400 text-sm">
															Prioritise savings/investments and debt payments, then spend what&apos;s left.
													</p>
												</div>
												<form method="get" className="flex items-end gap-2">
													<label className="block">
														<span className="text-xs font-medium text-slate-400 mb-2 block">Preview month</span>
														<SelectDropdown
															name="month"
															defaultValue={selectedMonth}
															options={MONTHS.map((m) => ({ value: m, label: m }))}
															buttonClassName="bg-slate-900/60 px-3 py-2 focus:ring-pink-500"
														/>
													</label>
													<button
														type="submit"
														className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
													>
														View
													</button>
												</form>
											</div>

											<div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 mb-5">
												<p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
													Left after paying yourself first
												</p>
												<p className="text-3xl font-extrabold text-white mt-1">£{monthSummary.unallocated.toFixed(2)}</p>
												<p className="text-xs text-slate-500 mt-2">Previewing: {selectedMonth} {monthSummary.year}</p>
												<p className="text-slate-400 text-sm mt-2">
													Increase Savings/Investments if you want to prioritise future goals.
												</p>
											</div>

											<div className="grid grid-cols-2 gap-3 text-sm">
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Savings (planned)</p>
													<p className="text-white font-bold">£{monthSummary.plannedSavings.toFixed(2)}</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Investments (planned)</p>
													<p className="text-white font-bold">£{monthSummary.plannedInvestments.toFixed(2)}</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Debt payments</p>
													<p className="text-white font-bold">£{monthSummary.debtPaymentsTotal.toFixed(2)}</p>
												</div>
												<div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
													<p className="text-slate-400">Expenses</p>
													<p className="text-white font-bold">£{monthSummary.expenseTotal.toFixed(2)}</p>
												</div>
											</div>
										</div>
									)}
								</div>
							</section>
						)}

						{activeSection === "locale" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Locale</h2>
										<p className="text-slate-400 text-sm">Country, language, and currency preferences.</p>
									</div>
									<span className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-medium text-slate-200">
										Regional
									</span>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 hover:border-white/20 transition-all">
									<div className="flex items-center gap-3 mb-6">
										<div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
											<Globe className="w-6 h-6 text-white" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white">Regional Settings</h3>
											<p className="text-slate-400 text-sm">Choose your country, language, and currency.</p>
										</div>
									</div>
									<form action={saveSettingsAction} className="space-y-4">
										<input type="hidden" name="budgetPlanId" value={budgetPlanId} />
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Country</span>
												<SelectDropdown
													name="country"
													defaultValue={settings.country ?? "GB"}
													options={SUPPORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
													buttonClassName="bg-slate-900/60 focus:ring-teal-500"
												/>
											</label>
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Language</span>
												<SelectDropdown
													name="language"
													defaultValue={settings.language ?? "en"}
													options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
													buttonClassName="bg-slate-900/60 focus:ring-teal-500"
												/>
											</label>
											<label className="block">
												<span className="text-sm font-medium text-slate-400 mb-2 block">Currency</span>
												<SelectDropdown
													name="currency"
													defaultValue={settings.currency ?? "GBP"}
													options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.name}` }))}
													buttonClassName="bg-slate-900/60 focus:ring-teal-500"
												/>
											</label>
										</div>
										<button
											type="submit"
											className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
										>
											Save Locale Settings
										</button>
									</form>
								</div>
							</section>
						)}

						{activeSection === "plans" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Budget Plans</h2>
										<p className="text-slate-400 text-sm">Manage your budget plans</p>
									</div>
								</div>

								{isPlansNewRoute ? (
									<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6 sm:p-8">
										<button
											type="button"
											onClick={() => router.push(`${settingsBasePath}/plans`, { scroll: false })}
											className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition"
										>
											<ArrowLeft className="h-4 w-4" />
											<span>Back to plans</span>
										</button>

										<div className="mt-4">
											{createBudgetPlanAction ? (
												<CreateBudgetForm
													action={createBudgetPlanAction}
													defaultBudgetType={createDefaultType}
													hasPersonalPlan={hasPersonalPlan}
													returnTo={`${settingsBasePath}/plans`}
												/>
											) : (
												<div className="text-sm text-slate-300">Unable to create a plan from this page.</div>
											)}
										</div>
									</div>
								) : (
									<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
										<div className="space-y-4">
											{hasPersonalPlan ? (
												<div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
													<div className="text-sm font-semibold text-slate-200">Add another plan</div>
													<div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
														<a
															href={`${settingsBasePath}/plans/new?type=holiday`}
															className="block w-full rounded-xl bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-white/15"
														>
															+ Create Holiday plan
														</a>
														<a
															href={`${settingsBasePath}/plans/new?type=carnival`}
															className="block w-full rounded-xl bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-white/15"
														>
															+ Create Carnival plan
														</a>
													</div>
													<div className="mt-2 text-xs text-slate-400">
														You can only create Holiday/Carnival once a Personal plan exists.
													</div>
												</div>
											) : (
												<div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
													<div className="text-sm font-semibold text-slate-200">Unlock Holiday & Carnival</div>
													<div className="mt-2 text-sm text-slate-300">
														Create your Personal plan first, then you’ll be able to add Holiday/Carnival budgets.
													</div>
													<div className="mt-3">
														<a
															href={`${settingsBasePath}/plans/new?type=personal`}
															className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
														>
															Create Personal plan
														</a>
													</div>
												</div>
											)}

											{allPlans.map((plan) => (
												<div
													key={plan.id}
													className={`p-4 rounded-xl border transition-all ${
														plan.id === budgetPlanId
															? "bg-blue-500/10 border-blue-500/50"
															: "bg-slate-900/40 border-white/10 hover:border-white/20"
													}`}
												>
													<div className="flex items-center justify-between">
														<div>
															<h3 className="font-bold text-white capitalize">{plan.name}</h3>
															<p className="text-sm text-slate-400 capitalize">{plan.kind} Plan</p>
														</div>
														{plan.id === budgetPlanId && (
															<span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
																Current
															</span>
														)}
													</div>
												</div>
											))}

											{allPlans.length === 0 && (
												<div className="text-center py-8 text-slate-400">
													<p>No budget plans found. Create one to get started.</p>
												</div>
											)}

											{allPlans.length < 3 && (
												<a
													href={`${settingsBasePath}/plans/new`}
													className="block w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold text-center shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
												>
													+ Create another budget
												</a>
											)}
										</div>
									</div>
								)}
							</section>
						)}

						{activeSection === "danger" && (
							<section className="space-y-6">
								<div className="flex items-center justify-between gap-4 mb-5">
									<div>
										<h2 className="text-2xl font-bold text-white">Danger Zone</h2>
										<p className="text-slate-400 text-sm">Actions here are permanent.</p>
									</div>
								</div>

								<div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-red-500/20 p-8 hover:border-red-500/30 transition-all">
									<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
										<div>
											<h3 className="text-xl font-bold text-white">Delete this budget plan</h3>
											<p className="text-slate-400 text-sm mt-1">
												This permanently deletes the plan and all associated data.
											</p>
										</div>
											<DeleteBudgetPlanButton
												budgetPlanId={budgetPlanId}
												planName={allPlans.find((p) => p.id === budgetPlanId)?.name}
												planKind={allPlans.find((p) => p.id === budgetPlanId)?.kind}
											/>
									</div>
								</div>
							</section>
						)}
					</main>
				</div>
			</div>
		</div>
	);
}
