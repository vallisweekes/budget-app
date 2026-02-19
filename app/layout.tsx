import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import AppShell from "./AppShell";
import AppHeader from "@/components/AppHeader";
import { Suspense } from "react";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="storm-cyan">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          // Keep this tiny and synchronous to avoid theme flash.
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const t = localStorage.getItem('theme'); document.documentElement.dataset.theme = t || 'storm-cyan'; } catch {} })();`,
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

