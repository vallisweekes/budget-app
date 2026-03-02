import { Prisma } from "@prisma/client";

let supportsExpenseMovedToDebtCached: boolean | null = null;
let supportsOnboardingPayFrequencyCached: boolean | null = null;
let supportsOnboardingBillFrequencyCached: boolean | null = null;

function hasPrismaField(modelName: string, fieldName: string): boolean {
	const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
	if (!model) return false;
	return model.fields.some((field) => field.name === fieldName);
}

export async function supportsExpenseMovedToDebtField(): Promise<boolean> {
	if (supportsExpenseMovedToDebtCached != null) return supportsExpenseMovedToDebtCached;
	supportsExpenseMovedToDebtCached = hasPrismaField("Expense", "isMovedToDebt");
	return supportsExpenseMovedToDebtCached;
}

export async function supportsOnboardingPayFrequencyField(): Promise<boolean> {
	if (supportsOnboardingPayFrequencyCached != null) return supportsOnboardingPayFrequencyCached;
	supportsOnboardingPayFrequencyCached = hasPrismaField("UserOnboardingProfile", "payFrequency");
	return supportsOnboardingPayFrequencyCached;
}

export async function supportsOnboardingBillFrequencyField(): Promise<boolean> {
	if (supportsOnboardingBillFrequencyCached != null) return supportsOnboardingBillFrequencyCached;
	supportsOnboardingBillFrequencyCached = hasPrismaField("UserOnboardingProfile", "billFrequency");
	return supportsOnboardingBillFrequencyCached;
}

export async function supportsOnboardingCadenceFields(): Promise<boolean> {
	const [hasPayFrequency, hasBillFrequency] = await Promise.all([
		supportsOnboardingPayFrequencyField(),
		supportsOnboardingBillFrequencyField(),
	]);
	return hasPayFrequency && hasBillFrequency;
}
