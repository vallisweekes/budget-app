import { useMemo } from "react";

export function usePayDateLabel(payDate: number | null | undefined): string {
	return useMemo(() => {
		const d = Math.max(1, Math.min(31, Number(payDate ?? 1)));
		const mod10 = d % 10;
		const mod100 = d % 100;
		const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
		return `${d}${suffix}`;
	}, [payDate]);
}
