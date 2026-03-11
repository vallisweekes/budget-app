import Link from "next/link";

import { consumeEmailVerificationToken } from "@/lib/auth/emailVerification";

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolved = await searchParams;
  const token = String(resolved?.token ?? "").trim();
  const result = await consumeEmailVerificationToken(token);

  const title = result === "verified"
    ? "Email verified"
    : result === "expired"
      ? "Verification link expired"
      : "Verification link invalid";

  const detail = result === "verified"
    ? "Your email is verified. Return to the mobile app and refresh if it is still open."
    : result === "expired"
      ? "Request a new verification email from the mobile app settings screen."
      : "Open the latest verification email from the app and try again.";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d14", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 520, borderRadius: 20, background: "#141826", color: "#f4f6ff", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{title}</h1>
        <p style={{ marginTop: 14, color: "rgba(244,246,255,0.72)", fontSize: 16, lineHeight: 1.6 }}>{detail}</p>
        <Link href="/login" style={{ display: "inline-block", marginTop: 18, color: "#a996ff", fontWeight: 700, textDecoration: "none" }}>
          Open BudgetIn Check
        </Link>
      </section>
    </main>
  );
}