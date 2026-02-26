"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { createDebt } from "@/lib/debts/actions";
import { getSettingsHrefFromPathname } from "@/lib/helpers/settings/settingsHref";
import { defaultDebtDueDateIso } from "@/lib/helpers/debts/defaultDebtDueDateIso";
import AddDebtFormPanel from "@/components/Admin/Debts/AddDebtFormPanel";

interface AddDebtFormProps {
	budgetPlanId: string;
	payDate: number;
	creditCards: Array<{ id: string; name: string }>;
}

export default function AddDebtForm({ budgetPlanId, payDate, creditCards }: AddDebtFormProps) {
	const pathname = usePathname();
	const settingsHref = getSettingsHrefFromPathname(pathname);

	const [isOpen, setIsOpen] = useState(false);
	const [type, setType] = useState("loan");
	const [creditLimit, setCreditLimit] = useState("");
	const [initialBalance, setInitialBalance] = useState("");
	const [installmentMonths, setInstallmentMonths] = useState("");
	const [dueDate, setDueDate] = useState(() => defaultDebtDueDateIso(payDate));
	const [defaultPaymentSource, setDefaultPaymentSource] = useState("income");
	const [defaultPaymentCardDebtId, setDefaultPaymentCardDebtId] = useState("");

	const isCardType = type === "credit_card" || type === "store_card";

	const handleSubmit = async (formData: FormData) => {
		await createDebt(formData);
		setIsOpen(false);
		setType("loan");
		setCreditLimit("");
		setInitialBalance("");
		setInstallmentMonths("");
		setDueDate(defaultDebtDueDateIso(payDate));
		setDefaultPaymentSource("income");
		setDefaultPaymentCardDebtId("");
	};

	if (!isOpen) {
		return (
			<button
				onClick={() => setIsOpen(true)}
				className="w-full md:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-[var(--cta)] hover:bg-[var(--cta-hover)] active:bg-[var(--cta-active)] text-white rounded-lg transition-colors font-medium shadow-lg hover:shadow-xl flex items-center gap-1.5 sm:gap-2 justify-center mb-6 sm:mb-8 text-sm sm:text-base"
			>
				<Plus className="w-4 h-4 sm:w-5 sm:h-5" />
				Add New Debt
			</button>
		);
	}

	return (
		<AddDebtFormPanel
			budgetPlanId={budgetPlanId}
			settingsHref={settingsHref}
			creditCards={creditCards}
			type={type}
			onTypeChange={(next) => {
				setType(next);
				if (next !== "credit_card" && next !== "store_card") setCreditLimit("");
			}}
			creditLimit={creditLimit}
			onCreditLimitChange={setCreditLimit}
			dueDate={dueDate}
			onDueDateChange={setDueDate}
			defaultPaymentSource={defaultPaymentSource}
			onDefaultPaymentSourceChange={(next) => {
				setDefaultPaymentSource(next);
				if (next !== "credit_card") setDefaultPaymentCardDebtId("");
			}}
			defaultPaymentCardDebtId={defaultPaymentCardDebtId}
			onDefaultPaymentCardDebtIdChange={setDefaultPaymentCardDebtId}
			initialBalance={initialBalance}
			onInitialBalanceChange={setInitialBalance}
			installmentMonths={installmentMonths}
			onInstallmentMonthsChange={setInstallmentMonths}
			isCardType={isCardType}
			onClose={() => setIsOpen(false)}
			onSubmit={handleSubmit}
		/>
	);
}
