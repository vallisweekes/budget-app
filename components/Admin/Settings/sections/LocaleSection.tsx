"use client";

import { Globe } from "lucide-react";
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "@/lib/constants/locales";
import { SelectDropdown } from "@/components/Shared";
import { saveSettingsAction } from "@/lib/settings/actions";
import type { Settings } from "@/lib/settings/store";

export default function LocaleSection({
	budgetPlanId,
	settings,
}: {
	budgetPlanId?: string | null;
	settings: Settings;
}) {
	const hasPlan = Boolean(String(budgetPlanId ?? "").trim());
	const currentCountry = SUPPORTED_COUNTRIES.find((c) => c.code === (settings.country ?? "GB"));
	const currentLanguage = SUPPORTED_LANGUAGES.find((l) => l.code === (settings.language ?? "en"));
	const currentCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === (settings.currency ?? "GBP"));

	return (
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
				{hasPlan ? (
					<form action={saveSettingsAction} className="space-y-4">
						<input type="hidden" name="budgetPlanId" value={String(budgetPlanId)} />
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
				) : (
					<div className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<span className="text-sm font-medium text-slate-400 mb-2 block">Country</span>
								<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg">
									{currentCountry?.name ?? settings.country ?? "GB"}
								</div>
							</div>
							<div>
								<span className="text-sm font-medium text-slate-400 mb-2 block">Language</span>
								<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg">
									{currentLanguage?.name ?? settings.language ?? "en"}
								</div>
							</div>
							<div>
								<span className="text-sm font-medium text-slate-400 mb-2 block">Currency</span>
								<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg">
									{currentCurrency ? `${currentCurrency.symbol} ${currentCurrency.name}` : settings.currency ?? "GBP"}
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm text-slate-300">
							Locale is saved per budget plan. Create a plan to edit these settings.
						</div>
					</div>
				)}
			</div>
		</section>
	);
}
