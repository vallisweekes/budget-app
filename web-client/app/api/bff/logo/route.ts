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

  try {
    for (const candidate of upstreamCandidates) {
      const response = await fetch(candidate, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "image/png";
      const bytes = await response.arrayBuffer();
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 502 });
  }
}
