"use client";

import { useState } from "react";

import { Edit2 } from "lucide-react";

import { SUPPORTED_COUNTRIES } from "@/lib/constants/locales";
import { updateUserDetailsAction } from "@/lib/settings/actions";
import { SelectDropdown } from "@/components/Shared";
import type { Settings } from "@/lib/settings/store";

export default function DetailsSection({
	budgetPlanId,
	settings,
	sessionUser,
}: {
	budgetPlanId?: string | null;
	settings: Settings;
	sessionUser: { id?: string; name?: string | null; email?: string | null };
}) {
	const [isEditingEmail, setIsEditingEmail] = useState(false);
	const hasPlan = Boolean(String(budgetPlanId ?? "").trim());
	const countryName =
		SUPPORTED_COUNTRIES.find((c) => c.code === (settings.country ?? "GB"))?.name ?? (settings.country ?? "GB");

	return (
		<section className="space-y-4 sm:space-y-6">
			<div className="flex items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
				<div>
					<h2 className="text-xl sm:text-2xl font-bold text-white">My Details</h2>
					<p className="text-slate-400 text-xs sm:text-sm">Your personal information</p>
				</div>
			</div>

			<div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 p-4 sm:p-8">
				<form action={updateUserDetailsAction} className="space-y-4 sm:space-y-6">
					{hasPlan ? <input type="hidden" name="budgetPlanId" value={String(budgetPlanId)} /> : null}

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
								onClick={() => setIsEditingEmail((v) => !v)}
								className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors"
								aria-label={isEditingEmail ? "Cancel editing" : "Edit email"}
							>
								<Edit2 className="w-4 h-4 text-slate-400" />
							</button>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-400 mb-2">Country</label>
						{hasPlan ? (
							<SelectDropdown
								name="country"
								defaultValue={settings.country ?? "GB"}
								options={SUPPORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
								buttonClassName="bg-slate-900/60 focus:ring-blue-500"
							/>
						) : (
							<div className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white text-lg">
								{countryName}
							</div>
						)}
						{hasPlan ? null : (
							<p className="text-xs text-slate-500 mt-1">
								Country is saved per budget plan. Create a plan to edit it.
							</p>
						)}
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
	);
}
