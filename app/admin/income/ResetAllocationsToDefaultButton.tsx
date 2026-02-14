"use client";

import { useFormStatus } from "react-dom";

function InnerButton({ label }: { label: string }) {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="text-xs font-medium text-slate-300 hover:text-white underline decoration-white/20 hover:decoration-white/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
		>
			{pending ? "Resetting…" : label}
		</button>
	);
}

export default function ResetAllocationsToDefaultButton(props: {
	budgetPlanId: string;
	month: string;
	action: (formData: FormData) => Promise<void>;
}) {
	return (
		<form
			action={props.action}
			onSubmit={(e) => {
				const ok = window.confirm("Reset this month back to plan defaults?");
				if (!ok) e.preventDefault();
			}}
		>
			<input type="hidden" name="budgetPlanId" value={props.budgetPlanId} />
			<input type="hidden" name="month" value={props.month} />
			<InnerButton label="Reset to plan default" />
		</form>
	);
}
