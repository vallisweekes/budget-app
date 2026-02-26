import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | BudgetIn Check",
  description: "Privacy Policy for BudgetIn Check mobile and web applications.",
};

const LAST_UPDATED = "26 February 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen app-theme-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 text-slate-100">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-300">Last updated: {LAST_UPDATED}</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-200">
          <p>
            This Privacy Policy describes how BudgetIn Check ("we", "our", "us") collects, uses, and
            protects your information when you use our mobile and web applications.
          </p>
          <p>
            Replace placeholders before publishing: legal entity name, support email, and business address.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            <li>Account details you provide (for example username and email address).</li>
            <li>Financial planning data you enter (income, expenses, debts, goals, settings).</li>
            <li>Receipt images and metadata if you use camera/photo import features.</li>
            <li>Push notification token if you enable notifications.</li>
            <li>Basic technical data needed to operate and secure the service.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">How We Use Information</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            <li>Provide budgeting, analytics, reminders, and account functionality.</li>
            <li>Sync your data across your devices.</li>
            <li>Send notifications you opt into (for example reminders and alerts).</li>
            <li>Maintain security, prevent abuse, and improve app reliability.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Sharing of Information</h2>
          <p className="text-sm text-slate-200">
            We do not sell your personal data. We may share limited information with service providers that
            help us deliver the app (for example hosting, authentication, notifications), under appropriate
            contractual safeguards.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Data Retention</h2>
          <p className="text-sm text-slate-200">
            We retain data while your account is active or as needed to provide the service, comply with legal
            obligations, resolve disputes, and enforce our agreements.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Your Choices</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            <li>You can update profile and budgeting data in the app.</li>
            <li>You can disable push notifications in device settings.</li>
            <li>You can request account/data deletion by contacting support.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Children&apos;s Privacy</h2>
          <p className="text-sm text-slate-200">
            Our services are not directed to children under 13 (or higher age where required by local law).
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-sm text-slate-200">
            For privacy questions or requests, contact us at: <strong>privacy@yourdomain.com</strong>
          </p>
          <p className="text-sm text-slate-300">Replace this with your real monitored support/privacy email.</p>
        </section>
      </div>
    </main>
  );
}
