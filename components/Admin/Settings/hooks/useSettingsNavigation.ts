import { useEffect, useMemo, useState } from "react";
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
	const [activeSection, setActiveSection] = useState<SettingsSectionId>("details");
	const [mobileView, setMobileView] = useState<"menu" | "content">("menu");

	const settingsBasePath = useMemo(() => getSettingsBasePath(pathname), [pathname]);
	const isContentView = mobileView === "content";

	useEffect(() => {
		const section = getSectionFromPath(pathname) as SettingsSectionId | null;
		if (section) {
			setActiveSection(section);
			setMobileView("content");
		} else {
			setMobileView("menu");
		}
	}, [pathname]);

	const openSection = (section: SettingsSectionId) => {
		setActiveSection(section);
		setMobileView("content");
		const next = `${settingsBasePath}/${(SECTION_TO_SLUG as Record<SettingsSectionId, string>)[section]}`;
		router.push(next, { scroll: false });
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			// Non-blocking
		}
	};

	const backToMenu = () => {
		setMobileView("menu");
		router.push(settingsBasePath, { scroll: false });
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			// Non-blocking
		}
	};

	return { activeSection, isContentView, mobileView, settingsBasePath, openSection, backToMenu };
}
