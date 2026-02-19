import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import AppShell from "./AppShell";
import AppHeader from "@/components/AppHeader";
import { Suspense } from "react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isThemeKey } from "@/components/Admin/Settings/theme";

function prismaUserHasField(fieldName: string): boolean {
  try {
    const fields = (prisma as any)?._runtimeDataModel?.models?.User?.fields;
    if (!Array.isArray(fields)) return false;
    return fields.some((f: any) => f?.name === fieldName);
  } catch {
    return false;
  }
}

async function getUserThemeFallback(userId: string): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ theme: unknown }>>`
      SELECT "theme" as theme
      FROM "User"
      WHERE id = ${userId}
      LIMIT 1
    `;
    const value = rows?.[0]?.theme;
    return typeof value === "string" ? value : String(value ?? "");
  } catch {
    // Column may not exist yet (or dev client is out-of-sync).
    return "";
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Budget App",
  description: "Personal budget calculator",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Budget App",
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f282f" },
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  let serverTheme: string = "";
  if (sessionUserId) {
    if (prismaUserHasField("theme")) {
      const user = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { theme: true } });
      const candidate = String((user as any)?.theme ?? "").trim();
      serverTheme = isThemeKey(candidate) ? candidate : "";
    } else {
      const candidate = String(await getUserThemeFallback(sessionUserId)).trim();
      serverTheme = isThemeKey(candidate) ? candidate : "";
    }
  }

  const htmlTheme = serverTheme || "storm-cyan";

  return (
    <html lang="en" suppressHydrationWarning data-theme={htmlTheme}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          // Keep this tiny and synchronous to avoid theme flash.
          dangerouslySetInnerHTML={{
            __html: `(() => { try {
  const valid = new Set(['nord-mint','calm-teal','storm-cyan','midnight-peach','soft-light']);
  const fromServer = ${JSON.stringify(serverTheme)};
  const fromStorage = localStorage.getItem('theme');
  const pick = (t) => (t && valid.has(t)) ? t : '';
  const next = pick(fromServer) || pick(fromStorage) || 'storm-cyan';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
} catch {} })();`,
          }}
        />
        <Providers>
          <Suspense fallback={null}>
            <AppHeader />
          </Suspense>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

