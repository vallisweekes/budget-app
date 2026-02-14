"use client";

import { useFormStatus } from "react-dom";

export default function AllocationsSaveButton() {
	const { pending } = useFormStatus();

	return (
		<button
			type="submit"
			disabled={pending}
			className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
		>
			{pending ? "Saving…" : "Save"}
		</button>
	);
}
