import type { ReactNode } from "react";

export default function SectionHeader(props: {
	title: string;
	subtitle?: string | null;
	badge?: ReactNode;
}) {
	const { title, subtitle, badge } = props;
	return (
		<div className="flex items-center justify-between gap-4 mb-5">
			<div>
				<h2 className="text-2xl font-bold text-white">{title}</h2>
				{subtitle ? <p className="text-slate-400 text-sm">{subtitle}</p> : null}
			</div>
			{badge ? badge : null}
		</div>
	);
}
