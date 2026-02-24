export type ResolvedExpenseLogo = {
  merchantDomain: string | null;
  logoUrl: string | null;
  logoSource: string | null;
};

const LOGO_DEV_PUBLISHABLE_KEY =
  process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() ||
  process.env.LOGO_DEV_TOKEN?.trim() ||
  "";

const KNOWN_DOMAINS: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /\bnetflix\b/i, domain: "netflix.com" },
  { pattern: /\bspotify\b/i, domain: "spotify.com" },
  { pattern: /\bamazon\b|\bprime\b/i, domain: "amazon.com" },
  { pattern: /\bapple\b|\bitunes\b|\bicloud\b/i, domain: "apple.com" },
  { pattern: /\bgoogle\b|\byoutube\b/i, domain: "google.com" },
  { pattern: /\buber\b/i, domain: "uber.com" },
  { pattern: /\bdeliveroo\b/i, domain: "deliveroo.co.uk" },
  { pattern: /\bjust\s*eat\b/i, domain: "just-eat.co.uk" },
  { pattern: /\brevolut\b/i, domain: "revolut.com" },
  { pattern: /\bmonzo\b/i, domain: "monzo.com" },
];

function sanitizeDomain(input?: string | null): string | null {
  if (!input) return null;
  const normalized = String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0];

  if (!normalized) return null;
  const valid = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(normalized);
  return valid ? normalized : null;
}

function inferDomainFromName(name: string): string | null {
  const candidate = String(name ?? "").trim();
  if (!candidate) return null;

  for (const { pattern, domain } of KNOWN_DOMAINS) {
    if (pattern.test(candidate)) return domain;
  }

  return null;
}

export function resolveExpenseLogo(name: string, merchantDomain?: string | null): ResolvedExpenseLogo {
  const explicitDomain = sanitizeDomain(merchantDomain);
  const inferredDomain = explicitDomain ? null : inferDomainFromName(name);
  const domain = explicitDomain ?? inferredDomain;

  if (!domain) {
    return { merchantDomain: null, logoUrl: null, logoSource: null };
  }

  const params = new URLSearchParams({
    size: "128",
    retina: "true",
    format: "png",
  });
  if (LOGO_DEV_PUBLISHABLE_KEY) params.set("token", LOGO_DEV_PUBLISHABLE_KEY);

  return {
    merchantDomain: domain,
    logoUrl: `https://img.logo.dev/${encodeURIComponent(domain)}?${params.toString()}`,
    logoSource: explicitDomain ? "manual" : "inferred",
  };
}
