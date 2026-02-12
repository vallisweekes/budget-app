"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

function getNavigationType(): string | undefined {
	try {
		const navEntries = performance.getEntriesByType("navigation");
		const nav = navEntries[0] as PerformanceNavigationTiming | undefined;
		return nav?.type;
	} catch {
		// ignore
	}

	// Deprecated fallback (Safari older versions)
	const legacyNav =
		typeof performance !== "undefined" && "navigation" in performance
			? (performance as unknown as { navigation: { type: number; TYPE_RELOAD: number } }).navigation
			: undefined;
	if (legacyNav?.type === legacyNav?.TYPE_RELOAD) return "reload";

	return undefined;
}

export default function RefreshLogoutGuard() {
	const { status } = useSession();
	const pathname = usePathname();
	const router = useRouter();
	const hasRunRef = useRef(false);

	useEffect(() => {
		if (hasRunRef.current) return;
		if (status !== "authenticated") return;
		if (!pathname || pathname === "/") return;

		const navType = getNavigationType();
		if (navType !== "reload") return;
		hasRunRef.current = true;

		(async () => {
			try {
				await fetch("/api/logout", { method: "POST", cache: "no-store" });
			} finally {
				router.replace("/?auth=1");
				router.refresh();
			}
		})();
	}, [pathname, router, status]);

	return null;
}
