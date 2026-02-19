"use client";

import { AlertTriangle, Bell, Coins, Globe, PiggyBank, User, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import SettingsMain from "@/components/Admin/Settings/SettingsMain";
import SettingsSidebar from "@/components/Admin/Settings/SettingsSidebar";
import { useThemePreview } from "@/components/Admin/Settings/hooks/useThemePreview";
import { useSettingsNavigation } from "@/components/Admin/Settings/hooks/useSettingsNavigation";
import { HeroCanvasLayoutClient } from "@/components/Shared";
import { updateUserThemeAction } from "@/lib/settings/actions";
import type { SettingsContentProps, SettingsNavItem, ThemeKey } from "@/types/components";

export default function SettingsContent(props: SettingsContentProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { theme, setTheme } = useThemePreview();
	const { activeSection, isContentView, openSection, backToMenu } = useSettingsNavigation({ pathname, router });

	const setAndPersistTheme = (next: ThemeKey) => {
		setTheme(next);
		const fd = new FormData();
		fd.set("theme", next);
		updateUserThemeAction(fd).catch(() => {
			// Non-blocking: keep the local preview even if persistence fails.
		});
	};

	const sections: SettingsNavItem[] = [
		{ id: "details", title: "My Details", description: "Your personal information", icon: User },
		{ id: "budget", title: "Budget", description: "Core settings for your monthly budgeting", icon: PiggyBank },
		{ id: "savings", title: "Savings and Cards", description: "Savings balances (and card settings)", icon: Coins },
		{ id: "locale", title: "Locale", description: "Country, language, and currency preferences", icon: Globe },
		{ id: "plans", title: "Plans", description: "Manage your budget plans", icon: Wallet },
		{ id: "notifications", title: "Notifications", description: "Push notifications on this device", icon: Bell },
		{ id: "danger", title: "Danger Zone", description: "Irreversible actions", icon: AlertTriangle },
	];

	return (
		<HeroCanvasLayoutClient
			maxWidthClassName="max-w-7xl"
			hero={
				<div className="space-y-1 sm:space-y-2">
					<h1 className="text-2xl sm:text-3xl font-bold text-white">Settings</h1>
					<p className="text-sm sm:text-base text-slate-400">Manage your account and budget preferences</p>
				</div>
			}
		>
			<div className="relative overflow-hidden min-h-[calc(100vh-6rem)]">
				<SettingsSidebar
					isHidden={isContentView}
					theme={theme}
					setTheme={setAndPersistTheme}
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
		</HeroCanvasLayoutClient>
	);
}
