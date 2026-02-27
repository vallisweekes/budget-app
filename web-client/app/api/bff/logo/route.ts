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

  if (!LOGO_DEV_PUBLISHABLE_KEY) {
    return NextResponse.json({ error: "Logo provider not configured" }, { status: 503 });
  }

  const upstream = new URL(`https://img.logo.dev/${encodeURIComponent(domain)}`);
  upstream.searchParams.set("token", LOGO_DEV_PUBLISHABLE_KEY);
  upstream.searchParams.set("format", "png");
  upstream.searchParams.set("size", "128");
  upstream.searchParams.set("retina", "true");
  upstream.searchParams.set("theme", theme);
  // Avoid returning generic monograms for unknown domains.
  upstream.searchParams.set("fallback", "404");

  try {
    const response = await fetch(upstream.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
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
  } catch {
    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 502 });
  }
}
