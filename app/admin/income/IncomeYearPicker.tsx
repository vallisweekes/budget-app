"use client";

import { SelectDropdown } from "@/components/Shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function IncomeYearPicker(props: {
	years: number[];
	selectedYear: number;
	className?: string;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const seen = new Set<number>();
	const orderedYears = props.years
		.map((y) => Number(y))
		.filter((y) => Number.isFinite(y))
		.filter((y) => {
			if (seen.has(y)) return false;
			seen.add(y);
			return true;
		});

	const options = orderedYears.map((y) => ({ value: String(y), label: String(y) }));

	return (
		<div className={props.className}>
			<SelectDropdown
				value={String(props.selectedYear)}
				onValueChange={(value) => {
					const nextYear = Number(value);
					if (!Number.isFinite(nextYear)) return;
					const params = new URLSearchParams(searchParams.toString());
					params.set("year", String(nextYear));
					router.replace(`${pathname}?${params.toString()}`, { scroll: false });
				}}
				options={options}
				buttonClassName="bg-slate-900/60 focus:ring-amber-500"
			/>
		</div>
	);
}
