import { ReactNode } from "react";

export default function Card({
	title,
	children,
	className,
}: {
	title?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={
				"rounded-2xl border border-white/10 bg-slate-800/40 backdrop-blur-xl p-4 shadow-xl text-white " +
				(className ?? "")
			}
		>
			{title && <div className="text-sm font-medium text-slate-300 mb-2">{title}</div>}
			{children}
		</div>
	);
}
