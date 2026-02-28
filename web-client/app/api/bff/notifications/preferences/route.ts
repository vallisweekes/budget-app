import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import {
  getUserNotificationPreferences,
  type UserNotificationPreferences,
} from "@/lib/push/userNotificationPreferences";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeBooleanOrUndefined(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") return undefined;
  return value;
}

type Body = {
  dueReminders?: unknown;
  paymentAlerts?: unknown;
};

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const prefs = await getUserNotificationPreferences(userId);
  return NextResponse.json({ ok: true, ...prefs });
}

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const dueReminders = normalizeBooleanOrUndefined(body.dueReminders);
  const paymentAlerts = normalizeBooleanOrUndefined(body.paymentAlerts);

  if (typeof dueReminders !== "boolean" && typeof paymentAlerts !== "boolean") {
    return badRequest("At least one notification preference must be provided");
  }

  try {
    if (typeof dueReminders === "boolean" && typeof paymentAlerts === "boolean") {
      await prisma.$executeRaw`
        UPDATE "User"
        SET
          "notificationDueReminders" = ${dueReminders},
          "notificationPaymentAlerts" = ${paymentAlerts}
        WHERE id = ${userId}
      `;
    } else if (typeof dueReminders === "boolean") {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "notificationDueReminders" = ${dueReminders}
        WHERE id = ${userId}
      `;
    } else if (typeof paymentAlerts === "boolean") {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "notificationPaymentAlerts" = ${paymentAlerts}
        WHERE id = ${userId}
      `;
    }
  } catch {
    // If columns are not yet available in a partially migrated environment,
    // return current defaults so the app can continue functioning.
  }

  const prefs: UserNotificationPreferences = await getUserNotificationPreferences(userId);
  return NextResponse.json({ ok: true, ...prefs });
}
