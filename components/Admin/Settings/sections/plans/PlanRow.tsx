"use client";

import Link from "next/link";

import DeleteBudgetPlanButton from "@/components/Admin/Settings/DeleteBudgetPlanButton";

export default function PlanRow({
	planSettingsHref,
	id,
	name,
	kind,
	isCurrent,
}: {
	planSettingsHref: (planId: string) => string;
	id: string;
	name: string;
	kind: string;
	isCurrent: boolean;
}) {
	const kindLabel = `${String(kind).slice(0, 1).toUpperCase()}${String(kind).slice(1).toLowerCase()}`;
	const canDelete = String(kind).toLowerCase() !== "personal";

	return (
		<div className="relative group">
			{canDelete ? (
				<div className="absolute right-2 top-2 z-10">
					<DeleteBudgetPlanButton
						budgetPlanId={id}
						planName={name}
						planKind={String(kind)}
						variant="icon"
						confirmMode="confirm"
					/>
				</div>
			) : null}

			<Link
				href={planSettingsHref(id)}
				className={`block rounded-xl border p-3 pr-12 transition ${
					isCurrent
						? "bg-blue-500/10 border-blue-500/40"
						: "bg-slate-900/35 border-white/10 hover:border-white/20 hover:bg-slate-900/45"
				}`}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="text-sm font-bold text-white truncate">{name}</div>
						<div className="mt-1 flex flex-wrap items-center gap-2">
							<span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-200 ring-1 ring-white/10">
								{kindLabel} plan
							</span>
							{isCurrent ? (
								<span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-200 ring-1 ring-blue-500/25">
									Current
								</span>
							) : null}
						</div>
					</div>
					<div className="shrink-0 text-xs font-semibold text-white/70 group-hover:text-white">Manage</div>
				</div>
			</Link>
		</div>
	);
}
