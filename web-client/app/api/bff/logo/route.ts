import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const LOGO_DEV_PUBLISHABLE_KEY =
  process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() ||
  process.env.LOGO_DEV_TOKEN?.trim() ||
  "";

function sanitizeDomain(input: string | null): string | null {
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = sanitizeDomain(searchParams.get("domain"));
  const themeRaw = (searchParams.get("theme") ?? "").trim().toLowerCase();
  const theme = themeRaw === "light" || themeRaw === "auto" || themeRaw === "dark" ? themeRaw : "dark";
  const debug = (searchParams.get("debug") ?? "").trim() === "1";
  if (!domain) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const upstreamCandidates: string[] = [];

  if (LOGO_DEV_PUBLISHABLE_KEY) {
    const logoDevUrl = new URL(`https://img.logo.dev/${encodeURIComponent(domain)}`);
    logoDevUrl.searchParams.set("token", LOGO_DEV_PUBLISHABLE_KEY);
    logoDevUrl.searchParams.set("format", "png");
    logoDevUrl.searchParams.set("size", "128");
    logoDevUrl.searchParams.set("retina", "true");
    logoDevUrl.searchParams.set("theme", theme);
    // Avoid generic monograms for unknown domains.
    logoDevUrl.searchParams.set("fallback", "404");
    upstreamCandidates.push(logoDevUrl.toString());
  }

  // Keyless fallback for environments where logo.dev is not configured.
  // Clearbit is public and works for many domains.
  upstreamCandidates.push(`https://logo.clearbit.com/${encodeURIComponent(domain)}?size=128`);

  // Final fallback: Google's favicon service. Often more reliable in production
  // environments than Clearbit for some domains / rate limits.
  upstreamCandidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);

  const fetchHeaders: Record<string, string> = {
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    // Some providers block default server fetch user agents.
    "User-Agent": "Mozilla/5.0 (compatible; BudgetInCheck/1.0; +https://budgetincheck.com)",
  };

  const attempts: Array<{ url: string; status: number; contentType: string | null }> = [];

  try {
    for (const candidate of upstreamCandidates) {
      const response = await fetch(candidate, {
        method: "GET",
        headers: fetchHeaders,
        signal: AbortSignal.timeout(6_000),
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type");
      attempts.push({
        url: candidate.replace(/([?&]token=)[^&]+/i, "$1***"),
        status: response.status,
        contentType,
      });

      if (debug) {
        // In debug mode we *only* report statuses; we still continue to try all candidates.
        // (Avoids leaking token while still helping diagnose 403/404/429 in prod.)
      }

      if (!response.ok) {
        continue;
      }

      const safeContentType = contentType && /^image\//i.test(contentType) ? contentType : "image/png";
      const bytes = await response.arrayBuffer();

      if (debug) {
        return NextResponse.json({ ok: true, domain, selected: candidate.replace(/([?&]token=)[^&]+/i, "$1***"), attempts });
      }

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": safeContentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    if (debug) {
      return NextResponse.json({ ok: false, domain, error: "Logo not found", attempts }, { status: 404 });
    }

    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  } catch {
    if (debug) {
      return NextResponse.json({ ok: false, domain, error: "Failed to fetch logo", attempts }, { status: 502 });
    }

    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 502 });
  }
}
