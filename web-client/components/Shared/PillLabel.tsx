import type { ReactNode } from "react";

export default function PillLabel({ children }: { children: ReactNode }) {
	return (
		<div className="inline-flex">
			<div
				className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
				style={{ backgroundColor: "#9EDBFF" }}
			>
				{children}
			</div>
		</div>
	);
}
