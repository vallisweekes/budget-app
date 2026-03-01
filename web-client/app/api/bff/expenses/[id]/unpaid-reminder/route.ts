import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";

import { getSessionUserId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ReminderPayload = {
  tip: string;
  reminderTitle: string;
  reminderBody: string;
  remindAt: string;
  remindInDays: number;
};

function clamp(value: string, max: number): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1)).trim()}…`;
}

function safeParseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), ms);
    });
    return (await Promise.race([promise, timeoutPromise])) as T | null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function toMidday(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function computeDaysUntilDue(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const today = toMidday(new Date());
  const due = toMidday(dueDate);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function computeFallbackReminder(params: {
  expenseName: string;
  daysUntilDue: number | null;
  payDate: number | null;
}): ReminderPayload {
  const name = clamp(params.expenseName, 50) || "this payment";
  const nowDay = new Date().getDate();
  const pastPayDate = typeof params.payDate === "number" && Number.isFinite(params.payDate)
    ? nowDay > params.payDate
    : false;

  let tip = "Marked unpaid. Keep an eye on this payment so it doesn't become debt.";
  if (params.daysUntilDue == null) {
    tip = "Marked unpaid. Add a due date and set a reminder so this payment doesn't turn into debt.";
  } else if (params.daysUntilDue <= 0) {
    tip = "Marked unpaid and overdue. Make a small payment soon to avoid this becoming debt.";
  } else if (params.daysUntilDue <= 5) {
    tip = `Marked unpaid. This is due in ${params.daysUntilDue} day${params.daysUntilDue === 1 ? "" : "s"}, so set aside a quick top-up.`;
  }

  if (pastPayDate && params.daysUntilDue != null && params.daysUntilDue <= 0) {
    tip = "Marked unpaid after pay date and due date. Treat this as urgent to prevent debt build-up.";
  }

  let remindInDays = 1;
  if (params.daysUntilDue == null) remindInDays = 2;
  else if (params.daysUntilDue > 2) remindInDays = 2;
  else if (params.daysUntilDue > 0) remindInDays = 1;

  const remindAt = new Date();
  remindAt.setDate(remindAt.getDate() + remindInDays);
  remindAt.setHours(9, 0, 0, 0);

  return {
    tip,
    reminderTitle: `Reminder: ${name}`,
    reminderBody: `You marked ${name} as unpaid. Check it and mark paid if done.`,
    remindAt: remindAt.toISOString(),
    remindInDays,
  };
}

async function buildAiReminder(params: {
  expenseName: string;
  amount: number;
  dueDateIso: string | null;
  daysUntilDue: number | null;
  payDate: number | null;
  fallback: ReminderPayload;
}): Promise<ReminderPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return params.fallback;

  const openai = new OpenAI({ apiKey });
  const sys =
    "You are a budgeting assistant. Create one practical tip and one reminder notification for an unpaid bill. " +
    "Tone: supportive, concise, non-judgmental. No legal advice. " +
    "Return ONLY JSON with shape: {\"tip\": string, \"reminderTitle\": string, \"reminderBody\": string, \"remindInDays\": number}. " +
    "Constraints: tip <= 160 chars, reminderTitle <= 60 chars, reminderBody <= 140 chars, remindInDays integer 1..3.";

  const user = JSON.stringify(
    {
      expenseName: params.expenseName,
      amount: params.amount,
      dueDateIso: params.dueDateIso,
      daysUntilDue: params.daysUntilDue,
      payDate: params.payDate,
      fallback: {
        tip: params.fallback.tip,
        reminderTitle: params.fallback.reminderTitle,
        reminderBody: params.fallback.reminderBody,
        remindInDays: params.fallback.remindInDays,
      },
    },
    null,
    2
  );

  const completion = await withTimeout(
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
    1400
  );

  if (!completion) return params.fallback;

  const raw = completion.choices?.[0]?.message?.content ?? "";
  const parsed = safeParseObject(raw);
  if (!parsed) return params.fallback;

  const tip = clamp(typeof parsed.tip === "string" ? parsed.tip : params.fallback.tip, 160);
  const reminderTitle = clamp(
    typeof parsed.reminderTitle === "string" ? parsed.reminderTitle : params.fallback.reminderTitle,
    60
  );
  const reminderBody = clamp(
    typeof parsed.reminderBody === "string" ? parsed.reminderBody : params.fallback.reminderBody,
    140
  );
  const rawDays = Number(parsed.remindInDays);
  const remindInDays = Number.isFinite(rawDays)
    ? Math.max(1, Math.min(3, Math.round(rawDays)))
    : params.fallback.remindInDays;

  const remindAt = new Date();
  remindAt.setDate(remindAt.getDate() + remindInDays);
  remindAt.setHours(9, 0, 0, 0);

  if (!tip || !reminderTitle || !reminderBody) return params.fallback;

  return {
    tip,
    reminderTitle,
    reminderBody,
    remindAt: remindAt.toISOString(),
    remindInDays,
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const expense = await prisma.expense.findFirst({
    where: {
      id,
      budgetPlan: {
        userId,
      },
    },
    select: {
      id: true,
      name: true,
      amount: true,
      dueDate: true,
      budgetPlan: {
        select: {
          payDate: true,
        },
      },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const amount = Number(expense.amount?.toString?.() ?? expense.amount ?? 0);
  const daysUntilDue = computeDaysUntilDue(expense.dueDate ?? null);
  const fallback = computeFallbackReminder({
    expenseName: expense.name,
    daysUntilDue,
    payDate: expense.budgetPlan?.payDate ?? null,
  });

  try {
    const ai = await buildAiReminder({
      expenseName: expense.name,
      amount: Number.isFinite(amount) ? amount : 0,
      dueDateIso: expense.dueDate ? expense.dueDate.toISOString() : null,
      daysUntilDue,
      payDate: expense.budgetPlan?.payDate ?? null,
      fallback,
    });

    return NextResponse.json(ai);
  } catch {
    return NextResponse.json(fallback);
  }
}
