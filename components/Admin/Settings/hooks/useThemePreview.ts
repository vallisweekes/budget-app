import { useEffect, useState } from "react";
import type { ThemeKey } from "@/types/components";
import { isThemeKey } from "@/components/Admin/Settings/theme";

export function useThemePreview(): { theme: ThemeKey; setTheme: (next: ThemeKey) => void } {
	const [theme, setTheme] = useState<ThemeKey>(() => {
		if (typeof document === "undefined") return "storm-cyan";
		const raw = document.documentElement.dataset.theme;
		return isThemeKey(raw) ? raw : "storm-cyan";
	});

	useEffect(() => {
		try {
			document.documentElement.dataset.theme = theme;
			localStorage.setItem("theme", theme);
		} catch {
			// Non-blocking; theme preview just won't persist.
		}
	}, [theme]);

	return { theme, setTheme };
}
