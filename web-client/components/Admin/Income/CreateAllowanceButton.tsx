"use client";

import { useFormStatus } from "react-dom";

export default function CreateAllowanceButton() {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="w-full rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900/60 transition disabled:opacity-60 disabled:cursor-not-allowed"
		>
			{pending ? "Creating…" : "Create allowance"}
		</button>
	);
}
