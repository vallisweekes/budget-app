"use client";

import { useTransition } from "react";

export default function ResetAllocationsToDefaultButton(props: {
	budgetPlanId: string;
	month: string;
	action: (formData: FormData) => Promise<void>;
}) {
	const [isPending, startTransition] = useTransition();

	const handleClick = () => {
		const ok = window.confirm("Reset this month back to plan defaults?");
		if (!ok) return;

		startTransition(async () => {
			const formData = new FormData();
			formData.append("budgetPlanId", props.budgetPlanId);
			formData.append("month", props.month);
			await props.action(formData);
		});
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isPending}
			className="text-xs font-medium text-slate-300 hover:text-white underline decoration-white/20 hover:decoration-white/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
		>
			{isPending ? "Resetting…" : "Reset to plan default"}
		</button>
	);
}
