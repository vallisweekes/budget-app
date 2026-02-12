"use server";

import { getSettings, saveSettings } from "@/lib/settings/store";

export async function saveSettingsAction(formData: FormData): Promise<void> {
	const current = await getSettings();

	const next = { ...current };

	if (formData.has("payDate")) {
		const raw = Number(formData.get("payDate"));
		const payDate = Number.isFinite(raw) ? raw : 27;
		next.payDate = Math.max(1, Math.min(31, payDate));
	}

	if (formData.has("monthlyAllowance")) {
		const raw = Number(formData.get("monthlyAllowance"));
		next.monthlyAllowance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("savingsBalance")) {
		const raw = Number(formData.get("savingsBalance"));
		next.savingsBalance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("monthlySavingsContribution")) {
		const raw = Number(formData.get("monthlySavingsContribution"));
		next.monthlySavingsContribution = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("monthlyInvestmentContribution")) {
		const raw = Number(formData.get("monthlyInvestmentContribution"));
		next.monthlyInvestmentContribution = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("budgetStrategy")) {
		const value = String(formData.get("budgetStrategy") || "").trim();
		next.budgetStrategy =
			value === "zeroBased" || value === "fiftyThirtyTwenty" || value === "payYourselfFirst"
				? value
				: undefined;
	}

	await saveSettings(next);
}
