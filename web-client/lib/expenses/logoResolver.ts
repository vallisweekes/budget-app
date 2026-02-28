export type ResolvedExpenseLogo = {
  merchantDomain: string | null;
  logoUrl: string | null;
  logoSource: string | null;
};

const LOGO_DEV_SECRET_KEY = process.env.LOGO_DEV_SECRET_KEY?.trim() || "";

/**
 * Custom static logo overrides for companies that logo.dev doesn't have or gets wrong.
 * Keys are merchant domains (matching KNOWN_DOMAINS entries).
 * Values are absolute URLs or root-relative paths served from the web-client /public folder.
 * Place the corresponding PNG/SVG files in web-client/public/logos/
 * e.g. web-client/public/logos/ee.png → accessible at /logos/ee.png
 */
const CUSTOM_LOGO_URLS: Record<string, string> = {
  "ee.co.uk":  "/logos/ee.png",
  "sky.com":   "/logos/sky.png",
  "apple.com": "/logos/apple-logo.jpg",
  "southwark.gov.uk": "/logos/southwark-council.jpg",
  "zurich.co.uk":     "/logos/zurich-insurance.png",
  "tvlicensing.co.uk": "/logos/tv-licensing.jpg",
};

/**
 * Name-based overrides for cases where we either don't know the domain or the user data doesn't include it.
 * These return a logo without persisting a (possibly wrong) merchantDomain.
 */
const CUSTOM_LOGO_NAME_OVERRIDES: Array<{ pattern: RegExp; logoUrl: string }> = [
  { pattern: /\btv\s*licen(?:s|c)e\b|\btv\s*licensing\b/i, logoUrl: "/logos/tv-licensing.jpg" },
];

function resolveCustomLogoForName(name: string): string | null {
  const candidate = String(name ?? "").trim();
  if (!candidate) return null;
  for (const { pattern, logoUrl } of CUSTOM_LOGO_NAME_OVERRIDES) {
    if (pattern.test(candidate)) return logoUrl;
  }
  return null;
}

export function hasCustomLogoForDomain(domain?: string | null): boolean {
  const normalized = sanitizeDomain(domain);
  if (!normalized) return false;
  return Boolean(CUSTOM_LOGO_URLS[normalized]);
}

export function hasCustomLogoForName(name?: string | null): boolean {
  return Boolean(resolveCustomLogoForName(String(name ?? "")));
}

const KNOWN_DOMAINS: Array<{ pattern: RegExp; domain: string }> = [
  // ── Streaming ────────────────────────────────────────────────────
  { pattern: /\bnetflix\b/i,                          domain: "netflix.com" },
  { pattern: /\bspotify\b/i,                          domain: "spotify.com" },
  { pattern: /\bdisney\s*\+?|disneyplus\b/i,          domain: "disneyplus.com" },
  { pattern: /\bprime\s*video|amazon\s*prime\b/i,     domain: "primevideo.com" },
  { pattern: /\bamazon\b/i,                           domain: "amazon.com" },
  { pattern: /\byoutube\b/i,                          domain: "youtube.com" },
  { pattern: /\bsky\s*(tv|sports|cinema|go|q)?\b|\bskytv\b/i, domain: "sky.com" },
  { pattern: /\bnow\s*tv\b/i,                         domain: "nowtv.com" },
  { pattern: /\bapple\s*tv\b/i,                       domain: "apple.com" },
  { pattern: /\bparamount\s*\+?\b/i,                  domain: "paramountplus.com" },
  { pattern: /\bhbo\b|\bmax\b/i,                      domain: "max.com" },
  { pattern: /\btwich\b|\btwitch\b/i,                 domain: "twitch.tv" },
  // ── Apple ────────────────────────────────────────────────────────
  { pattern: /\bapple\b|\bitunes\b|\bicloud\b|\bapp\s*store\b/i, domain: "apple.com" },
  // ── Google ───────────────────────────────────────────────────────
  { pattern: /\bgoogle\b/i,                           domain: "google.com" },
  // ── Music & audio ────────────────────────────────────────────────
  { pattern: /\btidal\b/i,                            domain: "tidal.com" },
  { pattern: /\bdeezer\b/i,                           domain: "deezer.com" },
  { pattern: /\bsoundcloud\b/i,                       domain: "soundcloud.com" },
  // ── UK telecoms ──────────────────────────────────────────────────
  { pattern: /\bee\s*(mobile|network|broadband)?\b/i, domain: "ee.co.uk" },
  { pattern: /\bbt\b|\bbritish\s*telecom\b/i,         domain: "bt.com" },
  { pattern: /\bvodafone\b/i,                         domain: "vodafone.co.uk" },
  { pattern: /\bo2\b/i,                               domain: "o2.co.uk" },
  { pattern: /\bthree\b|3\s*mobile\b/i,               domain: "three.co.uk" },
  { pattern: /\bvirgin\s*(media|mobile)?\b/i,         domain: "virginmedia.com" },
  { pattern: /\bgiffgaff\b/i,                         domain: "giffgaff.com" },
  { pattern: /\btalktalk\b/i,                         domain: "talktalk.co.uk" },
  { pattern: /\bsmart\s*y\b|\bsmarty\b/i,             domain: "smarty.co.uk" },
  { pattern: /\bskytel|sky\s*mobile\b/i,              domain: "skymobile.co.uk" },
  // ── Utilities ────────────────────────────────────────────────────
  { pattern: /\boctopus\s*(energy)?\b/i,              domain: "octopusenergy.com" },
  { pattern: /\bbulb\b/i,                             domain: "bulb.co.uk" },
  { pattern: /\be\.?on\b/i,                           domain: "eonenergy.com" },
  { pattern: /\bnpower\b/i,                           domain: "npower.com" },
  { pattern: /\bbritish\s*gas\b/i,                    domain: "britishgas.co.uk" },
  { pattern: /\bsso\s*energy|southern\s*electric\b/i, domain: "sse.co.uk" },
  { pattern: /\bthames\s*water\b/i,                   domain: "thameswater.co.uk" },
  // ── Finance & banking ─────────────────────────────────────────────
  { pattern: /\bplane\s*saver\b/i,                      domain: "planesavercu.co.uk" },
  // Novuna (formerly hit as "Novouma" typo)
  { pattern: /\bnovuna\s*personal\s*finance\b|\bpersonal\s*finance\b.*\bnovuna\b/i, domain: "novunapersonalfinance.co.uk" },
  { pattern: /\bnovouma\b/i,                          domain: "novunapersonalfinance.co.uk" },
  { pattern: /\bnovuna\b/i,                           domain: "novuna.co.uk" },
  { pattern: /\brevolut\b/i,                          domain: "revolut.com" },
  { pattern: /\bmonzo\b/i,                            domain: "monzo.com" },
  { pattern: /\bstarling\b/i,                         domain: "starlingbank.com" },
  { pattern: /\bwise\b|\btransfer\s*wise\b/i,          domain: "wise.com" },
  { pattern: /\bchase\b/i,                            domain: "chase.co.uk" },
  { pattern: /\bfirst\s*direct\b/i,                   domain: "firstdirect.com" },
  { pattern: /\btsb\b/i,                              domain: "tsb.co.uk" },
  { pattern: /\bmetro\s*bank\b/i,                     domain: "metrobankonline.co.uk" },
  { pattern: /\bvirgin\s*money\b/i,                   domain: "virginmoney.com" },
  { pattern: /\bco-?operative\s*bank\b|\bcoop\s*bank\b/i, domain: "co-operativebank.co.uk" },
  { pattern: /\bbank\s*of\s*scotland\b/i,             domain: "bankofscotland.co.uk" },
  { pattern: /\brbs\b|\broyal\s*bank\s*of\s*scotland\b/i, domain: "rbs.co.uk" },
  { pattern: /\bnationwide\b/i,                       domain: "nationwide.co.uk" },
  { pattern: /\bbarclays\b/i,                         domain: "barclays.co.uk" },
  { pattern: /\bbarclaycard\b/i,                      domain: "barclaycard.co.uk" },
  { pattern: /\blloyds\b/i,                           domain: "lloydsbank.com" },
  { pattern: /\bnatwest\b/i,                          domain: "natwest.com" },
  { pattern: /\bhsbc\b/i,                             domain: "hsbc.co.uk" },
  { pattern: /\bsantander\b/i,                        domain: "santander.co.uk" },
  { pattern: /\bhalifax\b/i,                          domain: "halifax.co.uk" },
  { pattern: /\btesco\s*bank\b/i,                     domain: "tescobank.com" },
  { pattern: /\bsainsbury\s*'?s\s*bank\b/i,           domain: "sainsburysbank.co.uk" },
  { pattern: /\bpost\s*office\s*(money|card)?\b/i,    domain: "postoffice.co.uk" },
  { pattern: /\bvanquis\s*bank\b|\bvanquis\b/i,       domain: "vanquis.co.uk" },
  { pattern: /\bamex\b|\bamerican\s*express\b/i,       domain: "americanexpress.com" },
  { pattern: /\bcapital\s*one\b/i,                    domain: "capitalone.co.uk" },
  { pattern: /\bmbna\b/i,                             domain: "mbna.co.uk" },
  { pattern: /\baqua\b/i,                             domain: "aquacard.co.uk" },
  { pattern: /\bnewday\b/i,                           domain: "newday.co.uk" },
  { pattern: /\bzopa\b/i,                             domain: "zopa.com" },
  { pattern: /\bklarna\b/i,                           domain: "klarna.com" },
  { pattern: /\bpaypal\b/i,                           domain: "paypal.com" },
  { pattern: /\baudible\b/i,                          domain: "audible.co.uk" },
  { pattern: /\bplaystation\s*plus\b|\bps\s*plus\b/i, domain: "playstation.com" },
  { pattern: /\bxbox\s*game\s*pass\b|\bgame\s*pass\b/i, domain: "xbox.com" },
  { pattern: /\bnintendo\s*switch\s*online\b/i,       domain: "nintendo.com" },
  // ── Cloud & software ─────────────────────────────────────────────
  { pattern: /\bdropbox\b/i,                          domain: "dropbox.com" },
  { pattern: /\bmicrosoft\s*3?6?5?|ms365|office\s*3?6?5?\b/i, domain: "microsoft.com" },
  { pattern: /\badobe\b/i,                            domain: "adobe.com" },
  { pattern: /\bnotion\b/i,                           domain: "notion.so" },
  { pattern: /\bslack\b/i,                            domain: "slack.com" },
  { pattern: /\bzoom\b/i,                             domain: "zoom.us" },
  { pattern: /\bfigma\b/i,                            domain: "figma.com" },
  { pattern: /\bgithub\b/i,                           domain: "github.com" },
  { pattern: /\bsiteground\b|site\s*ground\b/i,       domain: "siteground.com" },
  { pattern: /\bgo\s*-?\s*daddy\b|\bgodaddy\b/i,      domain: "godaddy.com" },
  { pattern: /\bwoo\s*commerce\b/i,                   domain: "woocommerce.com" },
  { pattern: /\bshopify\b/i,                          domain: "shopify.com" },
  { pattern: /\bwordpress\b/i,                        domain: "wordpress.com" },
  // ── Transport & delivery ─────────────────────────────────────────
  { pattern: /\buber\b/i,                             domain: "uber.com" },
  { pattern: /\bdeliveroo\b/i,                        domain: "deliveroo.co.uk" },
  { pattern: /\bjust\s*eat\b/i,                       domain: "just-eat.co.uk" },
  { pattern: /\bubereats\b|uber\s*eats\b/i,           domain: "ubereats.com" },
  { pattern: /\bgorillas\b/i,                         domain: "gorillas.io" },
  { pattern: /\bgetir\b/i,                            domain: "getir.com" },
  // ── UK services ─────────────────────────────────────────────────
  { pattern: /\btv\s*licen(?:s|c)e\b|\btv\s*licensing\b/i, domain: "tvlicensing.co.uk" },
  // ── Retail & shopping ────────────────────────────────────────────
  { pattern: /\btesco\b/i,                            domain: "tesco.com" },
  { pattern: /\bsainsbury\b/i,                        domain: "sainsburys.co.uk" },
  { pattern: /\basda\b/i,                             domain: "asda.com" },
  { pattern: /\bwaitrose\b/i,                         domain: "waitrose.com" },
  { pattern: /\bmorrisons\b/i,                        domain: "morrisons.com" },
  { pattern: /\baldi\b/i,                             domain: "aldi.co.uk" },
  { pattern: /\blidl\b/i,                             domain: "lidl.co.uk" },
  { pattern: /\bco-?op\b|\bthe\s*co-?operative\b/i,   domain: "coop.co.uk" },
  { pattern: /\bmarks\s*&?\s*spencer|m&s\b/i,         domain: "marksandspencer.com" },
  { pattern: /\bcostco\b/i,                           domain: "costco.co.uk" },
  { pattern: /\bikea\b/i,                             domain: "ikea.com" },
  { pattern: /\bargos\b/i,                            domain: "argos.co.uk" },
  { pattern: /\bjohn\s*lewis\b/i,                     domain: "johnlewis.com" },
  { pattern: /\bthe\s*white\s*company\b/i,            domain: "thewhitecompany.com" },
  { pattern: /\bdunelm\b/i,                           domain: "dunelm.com" },
  { pattern: /\bthe\s*range\b/i,                      domain: "therange.co.uk" },
  { pattern: /\bb&q\b|\bb\s*&\s*q\b/i,               domain: "diy.com" },
  { pattern: /\bhomebase\b/i,                         domain: "homebase.co.uk" },
  { pattern: /\bscrewfix\b/i,                         domain: "screwfix.com" },
  { pattern: /\bwickes\b/i,                           domain: "wickes.co.uk" },
  { pattern: /\btoolstation\b/i,                      domain: "toolstation.com" },
  { pattern: /\bcurrys\b|\bpc\s*world\b/i,            domain: "currys.co.uk" },
  { pattern: /\bao\.com\b|\bao\b/i,                   domain: "ao.com" },
  { pattern: /\bvery\b/i,                             domain: "very.co.uk" },
  { pattern: /\blittlewoods\b/i,                      domain: "littlewoods.com" },
  { pattern: /\bboots\b/i,                            domain: "boots.com" },
  { pattern: /\bsuperdrug\b/i,                        domain: "superdrug.com" },
  { pattern: /\bwhsmith\b|\bwh\s*smith\b/i,           domain: "whsmith.co.uk" },
  { pattern: /\bwaterstones\b/i,                      domain: "waterstones.com" },
  { pattern: /\bpoundland\b/i,                        domain: "poundland.co.uk" },
  { pattern: /\bb&m\b|\bb\s*&\s*m\b|\bb\s*and\s*m\b/i, domain: "bmstores.co.uk" },
  { pattern: /\bprimark\b/i,                          domain: "primark.com" },
  { pattern: /\bh\s*&\s*m\b|\bhm\b|\bh\s*and\s*m\b/i, domain: "hm.com" },
  { pattern: /\basos\b/i,                             domain: "asos.com" },
  { pattern: /\bnext\b/i,                             domain: "next.co.uk" },
  { pattern: /\bzara\b/i,                             domain: "zara.com" },
  { pattern: /\buniqlo\b/i,                           domain: "uniqlo.com" },
  { pattern: /\bmatalan\b/i,                          domain: "matalan.co.uk" },
  { pattern: /\bnew\s*look\b/i,                       domain: "newlook.com" },
  { pattern: /\bboohoo\b/i,                           domain: "boohoo.com" },
  { pattern: /\bmissguided\b/i,                       domain: "missguided.co.uk" },
  { pattern: /\bjd\s*sports\b/i,                      domain: "jdsports.co.uk" },
  { pattern: /\bsports\s*direct\b/i,                  domain: "sportsdirect.com" },
  { pattern: /\bdecathlon\b/i,                        domain: "decathlon.co.uk" },
  { pattern: /\bthe\s*north\s*face\b/i,               domain: "thenorthface.co.uk" },
  { pattern: /\bmountain\s*warehouse\b/i,             domain: "mountainwarehouse.com" },
  { pattern: /\bapple\s*store\b/i,                    domain: "apple.com" },
  { pattern: /\bebay\b/i,                             domain: "ebay.co.uk" },
  { pattern: /\betsy\b/i,                             domain: "etsy.com" },
  // ── Insurance ────────────────────────────────────────────────────
  { pattern: /\bdirect\s*line\b/i,                    domain: "directline.com" },
  { pattern: /\baviva\b/i,                            domain: "aviva.co.uk" },
  { pattern: /\badmiral\b/i,                          domain: "admiral.com" },
  { pattern: /\bcompare\s*the\s*market\b/i,           domain: "comparethemarket.com" },
  { pattern: /\bzurich\b/i,                           domain: "zurich.co.uk" },
  { pattern: /\bdomestic\s*(?:&|and)\s*general\b/i,    domain: "domesticandgeneral.com" },
  // ── UK councils ─────────────────────────────────────────────────
  { pattern: /\bsouthwark\s*council\b|\blondon\s*borough\s*of\s*southwark\b/i, domain: "southwark.gov.uk" },
  // ── Housing associations ────────────────────────────────────────
  { pattern: /\bsouthern\s*housing\b/i, domain: "southernhousing.org.uk" },
  // ── Fitness ──────────────────────────────────────────────────────
  { pattern: /\bpure\s*gym\b/i,                       domain: "puregym.com" },
  { pattern: /\bjd\s*gym\b/i,                         domain: "jdgyms.co.uk" },
  { pattern: /\bplanet\s*fitness\b/i,                 domain: "planetfitness.com" },
  { pattern: /\bpeloton\b/i,                          domain: "onepeloton.co.uk" },
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

function shouldAttemptLogoSearch(name: string): boolean {
  const query = String(name ?? "").trim().toLowerCase();
  if (!query) return false;

  // Keep this bounded to avoid excessive upstream requests.
  if (query.length > 42) return false;

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  // Default safety cap is 4 tokens, but many housing associations have longer names.
  // Allow up to 6 tokens when the query looks like a housing-association org name.
  if (tokens.length > 6) return false;

  // Many UK housing associations include otherwise-generic words like "housing" / "homes".
  // Allow logo.dev search for organization-looking queries (2-4 tokens with a distinctive term),
  // while still blocking truly generic budget-category labels.
  const hardBlockTerms = new Set([
    "work",
    "travel",
    "barber",
    "barbers",
    "rent",
    "utilities",
    "childcare",
    "groceries",
    "grocery",
    "food",
    "fuel",
    "transport",
    "allowance",
    "savings",
    "emergency",
    "income",
    "debt",
    "payment",
    "loan",
    "mortgage",
  ]);

  if (tokens.some((t) => hardBlockTerms.has(t))) return false;

  const housingOrgTerms = new Set(["housing", "homes", "association", "assoc", "assn", "trust", "group"]);
  const hasHousingSignal = tokens.some((t) => housingOrgTerms.has(t));
  const hasDistinctiveToken = tokens.some((t) => !housingOrgTerms.has(t) && /[a-z]/i.test(t) && t.length >= 4);
  if (!hasHousingSignal && tokens.length > 4) return false;
  if (hasHousingSignal && hasDistinctiveToken) return true;

  const genericTerms = new Set(["housing"]);
  if (tokens.some((t) => genericTerms.has(t))) return false;

  return /[a-z]/i.test(query);
}

export function resolveExpenseLogo(name: string, merchantDomain?: string | null): ResolvedExpenseLogo {
  const explicitDomain = sanitizeDomain(merchantDomain);
  const inferredDomain = explicitDomain ? null : inferDomainFromName(name);
  const domain = explicitDomain ?? inferredDomain;

  // Name-based static overrides (no domain required).
  if (!domain) {
    const customNameLogoUrl = resolveCustomLogoForName(name);
    if (customNameLogoUrl) {
      return { merchantDomain: null, logoUrl: customNameLogoUrl, logoSource: "custom-name" };
    }
    return { merchantDomain: null, logoUrl: null, logoSource: null };
  }

  // Prefer a static custom override (placed in public/logos/) over logo.dev.
  const customUrl = CUSTOM_LOGO_URLS[domain] ?? null;

  return {
    merchantDomain: domain,
    logoUrl: customUrl ?? `/api/bff/logo?domain=${encodeURIComponent(domain)}&theme=dark`,
    logoSource: explicitDomain ? "manual" : "inferred",
  };
}

export async function resolveExpenseLogoWithSearch(
  name: string,
  merchantDomain?: string | null
): Promise<ResolvedExpenseLogo> {
  const base = resolveExpenseLogo(name, merchantDomain);
  if (base.merchantDomain || base.logoUrl) return base;

  const query = String(name ?? "").trim();
  if (!query || !LOGO_DEV_SECRET_KEY || !shouldAttemptLogoSearch(query)) return base;

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
