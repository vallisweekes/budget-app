export function buildScopedPageHref(pathname: string | null, page: string): string {
	if (!pathname) return `/admin/${page}`;
	const idx = pathname.lastIndexOf("/page=");
	if (idx >= 0) return `${pathname.slice(0, idx)}/page=${page}`;

	const segments = pathname.split("/").filter(Boolean);
	const userIdx = segments.findIndex((s) => s.startsWith("user="));
	if (userIdx !== -1 && segments.length >= userIdx + 2) {
		const base = `/${segments[userIdx]}/${segments[userIdx + 1]}`;
		return `${base}/page=${page}`;
	}

	return `/admin/${page}`;
}

export function buildScopedPageHrefForPlan(pathname: string | null, budgetPlanId: string, page: string): string {
	if (!pathname) return `/admin/${page}`;
	const segments = pathname.split("/").filter(Boolean);
	const userIdx = segments.findIndex((s) => s.startsWith("user="));
	if (userIdx !== -1) {
		const userSegment = segments[userIdx];
		return `/${userSegment}/${encodeURIComponent(budgetPlanId)}/page=${page}`;
	}
	return buildScopedPageHref(pathname, page);
}
