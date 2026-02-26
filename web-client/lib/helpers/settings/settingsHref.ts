export function getSettingsHrefFromPathname(pathname: string | null | undefined): string {
	const parts = String(pathname ?? "")
		.split("/")
		.filter(Boolean);

	if (parts.length >= 2 && parts[0].startsWith("user=")) {
		return `/${parts[0]}/${parts[1]}/page=settings`;
	}

	return "/admin/settings";
}
