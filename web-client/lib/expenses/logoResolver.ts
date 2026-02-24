export type ResolvedExpenseLogo = {
  merchantDomain: string | null;
  logoUrl: string | null;
  logoSource: string | null;
};

const LOGO_DEV_SECRET_KEY = process.env.LOGO_DEV_SECRET_KEY?.trim() || "";

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

  return {
    merchantDomain: domain,
    logoUrl: `/api/bff/logo?domain=${encodeURIComponent(domain)}`,
    logoSource: explicitDomain ? "manual" : "inferred",
  };
}

export async function resolveExpenseLogoWithSearch(
  name: string,
  merchantDomain?: string | null
): Promise<ResolvedExpenseLogo> {
  const base = resolveExpenseLogo(name, merchantDomain);
  if (base.merchantDomain) return base;

  const query = String(name ?? "").trim();
  if (!query || !LOGO_DEV_SECRET_KEY) return base;

  try {
    const response = await fetch(
      `https://api.logo.dev/search?q=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${LOGO_DEV_SECRET_KEY}` },
        cache: "no-store",
      }
    );
    if (!response.ok) return base;

    const payload = (await response.json().catch(() => null)) as
      | Array<{ domain?: string | null }>
      | null;
    const firstDomain = sanitizeDomain(payload?.[0]?.domain ?? null);
    if (!firstDomain) return base;

    const resolved = resolveExpenseLogo(query, firstDomain);
    return {
      ...resolved,
      logoSource: "search",
    };
  } catch {
    return base;
  }
}
