import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | BudgetIn Check",
  description: "Terms of Service for BudgetIn Check mobile and web applications.",
};

const LAST_UPDATED = "26 February 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen app-theme-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 text-slate-100">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-300">Last updated: {LAST_UPDATED}</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-200">
          <p>
            These Terms of Service ("Terms") govern your access to and use of BudgetIn Check mobile and web
            applications. By using the service, you agree to these Terms.
          </p>
          <p>
            Replace placeholders before publishing: legal entity name, support email, jurisdiction, and any
            product-specific legal language you require.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">1. Eligibility and Account</h2>
          <p className="text-sm text-slate-200">
            You are responsible for maintaining the confidentiality of your account and for all activity under
            your account. Provide accurate information and keep it up to date.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">2. Acceptable Use</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            <li>Do not misuse, reverse engineer, or disrupt the service.</li>
            <li>Do not upload illegal or harmful content.</li>
            <li>Do not attempt unauthorized access to systems or data.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">3. Financial Disclaimer</h2>
          <p className="text-sm text-slate-200">
            BudgetIn Check provides budgeting and planning tools for informational purposes only and does not
            constitute financial, investment, legal, or tax advice.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">4. Service Availability</h2>
          <p className="text-sm text-slate-200">
            We may update, change, or discontinue features at any time. We do not guarantee uninterrupted
            availability.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">5. Limitation of Liability</h2>
          <p className="text-sm text-slate-200">
            To the maximum extent permitted by law, the service is provided "as is" without warranties, and we
            are not liable for indirect, incidental, or consequential damages arising from your use of the app.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">6. Termination</h2>
          <p className="text-sm text-slate-200">
            We may suspend or terminate access if these Terms are violated or if required for security,
            operational, or legal reasons.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">7. Privacy</h2>
          <p className="text-sm text-slate-200">
            Your use of the service is also governed by our Privacy Policy.
          </p>
          <Link href="/privacy-policy" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Read Privacy Policy
          </Link>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">8. Contact</h2>
          <p className="text-sm text-slate-200">
            Questions about these Terms: <strong>support@yourdomain.com</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
