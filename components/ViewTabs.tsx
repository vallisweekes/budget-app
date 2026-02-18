"use client";

import type { ViewTabsProps } from "@/types";
import ViewTabsDashboard from "@/components/ViewTabs/ViewTabsDashboard";

export default function ViewTabs(props: ViewTabsProps) {
	return <ViewTabsDashboard {...props} />;
}
