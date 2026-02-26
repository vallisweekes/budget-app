"use client";

import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/Shared";
import { saveSettingsAction } from "@/lib/settings/actions";
import { useStartingBalancesEditor } from "@/components/Admin/Settings/hooks/useStartingBalancesEditor";
import type { Settings } from "@/lib/settings/store";
import type { DebtCardDebt } from "@/types/components/debts";
import StartingBalancesCard from "@/components/Admin/Settings/sections/SavingsAndCards/StartingBalancesCard";
import CardsCard from "@/components/Admin/Settings/sections/SavingsAndCards/CardsCard";

export default function SavingsSection({
	budgetPlanId,
	settings,
	cardDebts,
}: {
	budgetPlanId?: string | null;
	settings: Settings;
	cardDebts: DebtCardDebt[];
}) {
	const router = useRouter();
	const hasPlan = Boolean(String(budgetPlanId ?? "").trim());
	const { isEditing, setIsEditing, isSaving, saveAction } = useStartingBalancesEditor({
		router,
		onSave: saveSettingsAction,
	});

	return (
		<section className="space-y-6">
			<SectionHeader
				title="Savings and Cards"
				subtitle="Starting balances used across the app."
				badge={
					<span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
						Balances
					</span>
				}
			/>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<StartingBalancesCard
					hasPlan={hasPlan}
					budgetPlanId={budgetPlanId}
					settings={settings}
					isEditing={isEditing}
					setIsEditing={setIsEditing}
					isSaving={isSaving}
					saveAction={saveAction}
				/>
				<CardsCard budgetPlanId={budgetPlanId} hasPlan={hasPlan} cardDebts={cardDebts} />
			</div>
		</section>
	);
}
