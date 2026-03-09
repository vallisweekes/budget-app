export const PRIVACY_POLICY_LAST_UPDATED = "26 February 2026";

export const PRIVACY_POLICY_INTRO =
  'This Privacy Policy describes how BudgetIn Check ("we", "our", "us") collects, uses, and protects your information when you use our mobile and web applications.';

export type PrivacyPolicySection = {
  title: string;
  body?: string;
  bullets?: string[];
};

export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    title: "Information We Collect",
    bullets: [
      "Account details you provide (for example username and email address).",
      "Financial planning data you enter (income, expenses, debts, goals, settings).",
      "Receipt images and metadata if you use camera/photo import features.",
      "Push notification token if you enable notifications.",
      "Basic technical data needed to operate and secure the service.",
    ],
  },
  {
    title: "How We Use Information",
    bullets: [
      "Provide budgeting, analytics, reminders, and account functionality.",
      "Sync your data across your devices.",
      "Send notifications you opt into (for example reminders and alerts).",
      "Maintain security, prevent abuse, and improve app reliability.",
    ],
  },
  {
    title: "Sharing of Information",
    body:
      "We do not sell your personal data. We may share limited information with service providers that help us deliver the app (for example hosting, authentication, notifications), under appropriate contractual safeguards.",
  },
  {
    title: "Data Retention",
    body:
      "We retain data while your account is active or as needed to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements.",
  },
  {
    title: "Your Choices",
    bullets: [
      "You can update profile and budgeting data in the app.",
      "You can disable push notifications in device settings.",
      "You can request account/data deletion by contacting support.",
    ],
  },
  {
    title: "Children's Privacy",
    body: "Our services are not directed to children under 13 (or higher age where required by local law).",
  },
  {
    title: "Contact",
    body: "For privacy questions or requests, contact us at: privacy@budgetincheck.com",
  },
];