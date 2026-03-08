import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request) {
  const userId = await getSessionUserId(request);
  if (!userId) return unauthorized();

  return NextResponse.json({
    current: {
      status: "free",
      planKey: "free",
      planLabel: "Free",
      billingLabel: "All features are currently free during the launch phase.",
      renewalLabel: null,
      manageLabel: "Billing is not live yet.",
    },
    offers: [
      {
        id: "pro_monthly",
        title: "Pro Monthly",
        priceLabel: "GBP 4.99",
        billingLabel: "per month",
        highlight: true,
        bullets: [
          "Keep the full budgeting experience",
          "Priority access to new tools",
          "Early premium rollout pricing",
        ],
      },
      {
        id: "pro_yearly",
        title: "Pro Yearly",
        priceLabel: "GBP 49.99",
        billingLabel: "per year",
        highlight: false,
        bullets: [
          "Everything in Pro Monthly",
          "Lower annual price",
          "Best value for long-term users",
        ],
      },
    ],
    launchState: {
      mode: "soft_launch",
      canPurchase: false,
      message: "Subscriptions are being prepared. Upgrade entry points are visible, but billing is not live yet.",
    },
  });
}