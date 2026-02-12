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
	const legacy: any = typeof performance !== "undefined" ? (performance as any).navigation : undefined;
	if (legacy?.type === legacy?.TYPE_RELOAD) return "reload";

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
				router.replace("/");
				router.refresh();
			}
		})();
	}, [pathname, router, status]);

	return null;
}
