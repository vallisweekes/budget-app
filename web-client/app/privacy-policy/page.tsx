import type { Metadata } from "next";
import Link from "next/link";
import {
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "../../../shared/legal/privacyPolicy";

export const metadata: Metadata = {
  title: "Privacy Policy | BudgetIn Check",
  description: "Privacy Policy for BudgetIn Check mobile and web applications.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen app-theme-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 text-slate-100">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-300">Last updated: {PRIVACY_POLICY_LAST_UPDATED}</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-200">
          <p>{PRIVACY_POLICY_INTRO}</p>
        </section>

        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section key={section.title} className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.body ? <p className="text-sm text-slate-200">{section.body}</p> : null}
            {section.bullets ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section className="mt-8 space-y-3">
          <Link href="/terms" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Read Terms of Service
          </Link>
        </section>
      </div>
    </main>
  );
}
