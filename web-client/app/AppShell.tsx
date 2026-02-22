"use client";

import { ReactNode, Suspense } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function AppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const isSplash = pathname === "/";

	if (isSplash) {
		return <main className="min-h-screen">{children}</main>;
	}

	return (
		<div className="flex min-h-screen">
			<Suspense fallback={null}>
				<Sidebar />
			</Suspense>
			<main className="flex-1 lg:ml-72 xl:ml-80 pb-20 lg:pb-0">{children}</main>
			<Suspense fallback={null}>
				<MobileBottomNav />
			</Suspense>
		</div>
	);
}
