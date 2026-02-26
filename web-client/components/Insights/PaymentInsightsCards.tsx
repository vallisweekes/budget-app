"use client";

import { useEffect, useMemo, useState } from "react";
import type { PreviousMonthRecap, UpcomingPayment, RecapTip } from "@/lib/expenses/insights";
import RecapCard from "@/components/Insights/PaymentInsights/RecapCard";
import UpcomingPaymentsCard from "@/components/Insights/PaymentInsights/UpcomingPaymentsCard";
import RecapTipCard from "@/components/Insights/PaymentInsights/RecapTipCard";

export default function PaymentInsightsCards({
	recap,
	recapTips,
	upcoming,
	showRecap = true,
	showUpcoming = true,
}: {
	recap?: PreviousMonthRecap | null;
	recapTips?: RecapTip[] | null;
	upcoming?: UpcomingPayment[] | null;
	showRecap?: boolean;
	showUpcoming?: boolean;
}) {
	const shouldShowRecap = showRecap && !!recap;
	const shouldShowUpcoming = showUpcoming;

	const tips = useMemo(() => {
		return Array.isArray(recapTips) ? recapTips.filter((t) => t && t.title && t.detail) : [];
	}, [recapTips]);

	const [tipIndex, setTipIndex] = useState(0);

	useEffect(() => {
		if (tips.length <= 1) return;
		const id = window.setInterval(() => {
			setTipIndex((i) => (tips.length ? (i + 1) % tips.length : 0));
		}, 20_000);
		return () => window.clearInterval(id);
	}, [tips.length]);

	const activeTip = tips.length ? tips[tipIndex % tips.length] : null;
	const shouldShowTipCard = !!activeTip && (shouldShowRecap || shouldShowUpcoming);

	const upcomingColClass =
		shouldShowRecap && shouldShowTipCard
			? "lg:col-span-6 lg:row-start-1 lg:row-span-2"
			: shouldShowRecap
				? "lg:col-span-6"
				: "lg:col-span-12";

	const tipColClass =
		shouldShowRecap && shouldShowUpcoming
			? "lg:col-span-6 lg:row-start-2 h-full"
			: shouldShowUpcoming
				? "lg:col-span-12"
				: "lg:col-span-12";

	return (
		<div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-3">
			{shouldShowRecap ? <RecapCard recap={recap as PreviousMonthRecap} fullWidth={!shouldShowUpcoming} /> : null}

			{shouldShowUpcoming ? <UpcomingPaymentsCard upcoming={upcoming} colClass={upcomingColClass} /> : null}

			{shouldShowTipCard && activeTip ? <RecapTipCard tip={activeTip} colClass={tipColClass} /> : null}
		</div>
	);
}
