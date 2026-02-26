import { useMemo } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getSectionFromPath, getSettingsBasePath, SECTION_TO_SLUG } from "@/lib/helpers/settings/navigation";
import type { SettingsSectionId } from "@/types/components";

export function useSettingsNavigation({
	pathname,
	router,
}: {
	pathname: string;
	router: AppRouterInstance;
}): {
	activeSection: SettingsSectionId;
	isContentView: boolean;
	mobileView: "menu" | "content";
	settingsBasePath: string;
	openSection: (section: SettingsSectionId) => void;
	backToMenu: () => void;
} {
	const settingsBasePath = useMemo(() => getSettingsBasePath(pathname), [pathname]);
	const sectionFromPath = useMemo(() => getSectionFromPath(pathname) as SettingsSectionId | null, [pathname]);
	const activeSection = sectionFromPath ?? "details";
	const mobileView: "menu" | "content" = sectionFromPath ? "content" : "menu";
	const isContentView = mobileView === "content";

	const openSection = (section: SettingsSectionId) => {
		const next = `${settingsBasePath}/${(SECTION_TO_SLUG as Record<SettingsSectionId, string>)[section]}`;
		router.push(next, { scroll: false });
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			// Non-blocking
		}
	};

	const backToMenu = () => {
		router.push(settingsBasePath, { scroll: false });
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			// Non-blocking
		}
	};

	return { activeSection, isContentView, mobileView, settingsBasePath, openSection, backToMenu };
}
