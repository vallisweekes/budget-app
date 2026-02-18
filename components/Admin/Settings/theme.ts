import type { ThemeKey, ThemeOption } from "@/types/components";

export const THEME_OPTIONS: ThemeOption[] = [
	{ value: "nord-mint", label: "Nord Mint", description: "Minimal, premium, muted" },
	{ value: "calm-teal", label: "Calm Teal", description: "Modern, calm, slightly fintech" },
	{ value: "midnight-peach", label: "Midnight + Peach", description: "Friendly, energetic, not corporate" },
	{ value: "soft-light", label: "Soft Light", description: "Bright, everyday, lifestyle" },
];

export function isThemeKey(value: unknown): value is ThemeKey {
	return value === "midnight-peach" || value === "nord-mint" || value === "soft-light" || value === "calm-teal";
}
