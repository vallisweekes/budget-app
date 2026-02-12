"use client";

import { ReactNode, Suspense } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RefreshLogoutGuard from "./RefreshLogoutGuard";

export default function AppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const isSplash = pathname === "/";

	if (isSplash) {
		return <main className="min-h-screen">{children}</main>;
	}

	return (
		<div className="flex min-h-screen">
			<RefreshLogoutGuard />
			<Suspense fallback={null}>
				<Sidebar />
			</Suspense>
			<main className="flex-1 lg:ml-64">{children}</main>
		</div>
	);
}
