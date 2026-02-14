"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SaveKind = "allocations" | "allocationsReset" | "allowanceCreated" | "income";

export default function SaveFeedbackBanner({
	kind,
	message,
}: {
	kind: SaveKind;
	message: string;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const savedValue = searchParams.get("saved");
	const show = savedValue === kind;

	const searchParamsString = useMemo(() => searchParams.toString(), [searchParams]);

	useEffect(() => {
		if (!show) return;

		const timeout = setTimeout(() => {
			const next = new URLSearchParams(searchParamsString);
			next.delete("saved");
			const qs = next.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		}, 2500);

		return () => clearTimeout(timeout);
	}, [pathname, router, searchParamsString, show]);

	if (!show) return null;

	return (
		<div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-emerald-100">
			<div className="flex items-start justify-between gap-3">
				<div className="text-sm">
					<span className="font-semibold">Saved.</span> {message}
				</div>
			</div>
		</div>
	);
}
