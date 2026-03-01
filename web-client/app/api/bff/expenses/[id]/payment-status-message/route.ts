import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";

import { getSessionUserId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PaymentStatus = "paid" | "unpaid";

type MessagePayload = {
  title: string;
  body: string;
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

function computeFallback(params: {
  status: PaymentStatus;
  expenseName: string;
  remainingAmount: number;
  currency: string;
}): MessagePayload {
  const name = clamp(params.expenseName, 44) || "that bill";
  const remaining = Number.isFinite(params.remainingAmount) ? Math.max(0, params.remainingAmount) : 0;

  if (params.status === "paid") {
    return {
      title: "Sorted — bill paid",
      body: `${name} is all sorted. Nice one — that's more room in your monthly budget pot.`,
    };
  }

  const impact = remaining > 0.005
    ? `About ${params.currency}${remaining.toFixed(2)} still sits in your spending plan.`
    : "It can still squeeze your monthly budget if left open.";

  return {
    title: "Marked unpaid",
    body: `${name} is now unpaid. ${impact} Keep an eye on it so it doesn't roll into debt.`,
  };
}

async function buildAiMessage(params: {
  status: PaymentStatus;
  expenseName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDateIso: string | null;
  currency: string;
  fallback: MessagePayload;
}): Promise<MessagePayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return params.fallback;

  const openai = new OpenAI({ apiKey });

  const systemPrompt =
    "You generate short push notification copy for a UK personal budgeting app. " +
    "Use UK English vocabulary and a fun, encouraging tone. " +
    "Always mention budget impact naturally. " +
    "No emojis. No hype. No legal advice. " +
    "Return ONLY valid JSON: {\"title\": string, \"body\": string}. " +
    "Constraints: title <= 55 chars, body <= 135 chars.";

  const userPrompt = JSON.stringify(
    {
      status: params.status,
      expenseName: params.expenseName,
      amount: params.amount,
      paidAmount: params.paidAmount,
      remainingAmount: params.remainingAmount,
      dueDateIso: params.dueDateIso,
      currency: params.currency,
      fallback: params.fallback,
      styleHint:
        params.status === "paid"
          ? "Celebrate completion with fresh varied wording each time."
          : "Supportive warning that unpaid items can affect budget and become debt.",
    },
    null,
    2
  );

  const completion = await withTimeout(
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.75,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    1500
  );

  if (!completion) return params.fallback;

  const raw = completion.choices?.[0]?.message?.content ?? "";
  const parsed = safeParseObject(raw);
  if (!parsed) return params.fallback;

  const title = clamp(typeof parsed.title === "string" ? parsed.title : params.fallback.title, 55);
  const body = clamp(typeof parsed.body === "string" ? parsed.body : params.fallback.body, 135);
  if (!title || !body) return params.fallback;

  return { title, body };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  const status = body.status === "unpaid" ? "unpaid" : "paid";

  const expense = await prisma.expense.findFirst({
    where: {
      id,
      budgetPlan: { userId },
    },
    select: {
      id: true,
      name: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      budgetPlan: {
        select: { currency: true },
      },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const amount = Number(expense.amount?.toString?.() ?? expense.amount ?? 0);
  const paidAmount = Number(expense.paidAmount?.toString?.() ?? expense.paidAmount ?? 0);
  const remainingAmount = Math.max(0, amount - paidAmount);
  const currencyCode = (expense.budgetPlan?.currency ?? "GBP").trim().toUpperCase();
  const currency = currencyCode === "GBP" ? "£" : `${currencyCode} `;

  const fallback = computeFallback({
    status,
    expenseName: expense.name,
    remainingAmount,
    currency,
  });

  try {
    const message = await buildAiMessage({
      status,
      expenseName: expense.name,
      amount,
      paidAmount,
      remainingAmount,
      dueDateIso: expense.dueDate ? expense.dueDate.toISOString() : null,
      currency,
      fallback,
    });
    return NextResponse.json(message);
  } catch {
    return NextResponse.json(fallback);
  }
}
