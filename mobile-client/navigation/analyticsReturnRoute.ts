const DEFAULT_ANALYTICS_RETURN_HREF = "/(tabs)/dashboard";

let analyticsReturnHref = DEFAULT_ANALYTICS_RETURN_HREF;

const ANALYTICS_PATHS = [
  "/analytics",
  "/analytics-month",
  "/analytics-year",
  "/(tabs)/analytics-month",
  "/(tabs)/analytics-year",
];

export function isAnalyticsNavigationHref(href: string): boolean {
  const normalizedHref = String(href ?? "").trim();
  if (!normalizedHref.startsWith("/")) {
    return false;
  }

  const pathOnly = normalizedHref.split("?")[0] ?? "";
  return ANALYTICS_PATHS.some((analyticsPath) => pathOnly === analyticsPath);
}

export function rememberAnalyticsReturnHref(href: string | null | undefined) {
  const normalizedHref = String(href ?? "").trim();
  if (!normalizedHref || !normalizedHref.startsWith("/") || isAnalyticsNavigationHref(normalizedHref)) {
    return;
  }

  analyticsReturnHref = normalizedHref;
}

export function getAnalyticsReturnHref(): string {
  return analyticsReturnHref;
}