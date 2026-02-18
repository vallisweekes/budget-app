export type SettingsSection = "details" | "budget" | "locale" | "plans" | "danger";

export const SECTION_TO_SLUG: Record<SettingsSection, string> = {
	details: "my-details",
	budget: "budget",
	locale: "locale",
	plans: "plans",
	danger: "danger-zone",
};

export const SLUG_TO_SECTION: Record<string, SettingsSection> = {
	"my-details": "details",
	budget: "budget",
	locale: "locale",
	plans: "plans",
	"danger-zone": "danger",
};

export function getSettingsBasePath(pathname: string): string {
	const parts = String(pathname ?? "")
		.split("/")
		.filter(Boolean);
	const idx = parts.findIndex((p) => p === "page=settings" || p === "settings");
	if (idx === -1) return String(pathname ?? "");
	return `/${parts.slice(0, idx + 1).join("/")}`;
}

export function getUserSegmentFromPath(pathname: string): string | null {
	const parts = String(pathname ?? "")
		.split("/")
		.filter(Boolean);
	return parts.find((p) => p.startsWith("user=")) ?? null;
}

export function getSectionFromPath(pathname: string): SettingsSection | null {
	const parts = String(pathname ?? "")
		.split("/")
		.filter(Boolean);
	const idx = parts.findIndex((p) => p === "page=settings" || p === "settings");
	if (idx === -1) return null;
	const slug = parts[idx + 1];
	if (!slug) return null;
	return SLUG_TO_SECTION[slug] ?? null;
}
