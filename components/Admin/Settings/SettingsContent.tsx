"use client";

import { AlertTriangle, Coins, Globe, PiggyBank, User, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import SettingsMain from "@/components/Admin/Settings/SettingsMain";
import SettingsSidebar from "@/components/Admin/Settings/SettingsSidebar";
import { useThemePreview } from "@/components/Admin/Settings/hooks/useThemePreview";
import { useSettingsNavigation } from "@/components/Admin/Settings/hooks/useSettingsNavigation";
import type { SettingsContentProps, SettingsNavItem } from "@/types/components";

export default function SettingsContent(props: SettingsContentProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { theme, setTheme } = useThemePreview();
	const { activeSection, isContentView, openSection, backToMenu } = useSettingsNavigation({ pathname, router });

	const sections: SettingsNavItem[] = [
		{ id: "details", title: "My Details", description: "Your personal information", icon: User },
		{ id: "budget", title: "Budget", description: "Core settings for your monthly budgeting", icon: PiggyBank },
		{ id: "savings", title: "Savings", description: "Savings & emergency balances", icon: Coins },
		{ id: "locale", title: "Locale", description: "Country, language, and currency preferences", icon: Globe },
		{ id: "plans", title: "Plans", description: "Manage your budget plans", icon: Wallet },
		{ id: "danger", title: "Danger Zone", description: "Irreversible actions", icon: AlertTriangle },
	];

	return (
		<div className="min-h-screen pb-20 app-theme-bg">
			<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
				<div className="relative overflow-hidden min-h-[calc(100vh-6rem)]">
					<SettingsSidebar
						isHidden={isContentView}
						theme={theme}
						setTheme={setTheme}
						sections={sections}
						activeSectionId={activeSection}
						onOpenSection={openSection}
					/>
					<SettingsMain
						isHidden={!isContentView}
						activeSection={activeSection}
						onBack={backToMenu}
						{...props}
					/>
				</div>
			</div>
		</div>
	);
}
