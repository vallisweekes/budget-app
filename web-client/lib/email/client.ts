import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY environment variable is not set");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

/** The "from" address used for all outgoing emails.
 *  Update this once you have a verified domain in Resend.
 *  Until then, Resend allows sending from onboarding@resend.dev in test mode.
 */
export const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "BudgetIn <onboarding@resend.dev>";
