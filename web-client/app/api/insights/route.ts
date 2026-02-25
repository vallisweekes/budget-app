import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type TransactionInput = {
  amount: number;
  description?: string;
  date?: string;
  category?: string;
};

type TransactionMaybe = {
	amount: number | null;
	description?: string;
	date?: string;
	category?: string;
};

const toNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = (await req.json().catch(() => null)) as
      | { transactions?: unknown }
      | null;

    const rawTransactions = body?.transactions;
    if (!Array.isArray(rawTransactions)) {
      return NextResponse.json(
        { error: "transactions must be an array" },
        { status: 400 }
      );
    }

    const maybeTransactions: TransactionMaybe[] = rawTransactions
      .map((t) => {
        const obj = t as any;
        return {
          amount: toNumber(obj?.amount),
          description: typeof obj?.description === "string" ? obj.description : undefined,
          date: typeof obj?.date === "string" ? obj.date : undefined,
          category: typeof obj?.category === "string" ? obj.category : undefined,
        };
      });

    const transactions: TransactionInput[] = maybeTransactions
		.filter((t): t is TransactionInput => typeof t.amount === "number")
		.map((t) => ({
			amount: t.amount,
			description: t.description,
			date: t.date,
			category: t.category,
		}));

    // Treat positive amounts as spending.
    const spending = transactions.map((t) => ({ ...t, amount: Number(t.amount) })).filter((t) => t.amount > 0);

    const totalSpent = spending.reduce((sum, t) => sum + t.amount, 0);
    const count = spending.length;
    const avg = count > 0 ? totalSpent / count : 0;
    const max = count > 0 ? Math.max(...spending.map((t) => t.amount)) : 0;

    const topCategories = (() => {
      const byCat = new Map<string, number>();
      for (const t of spending) {
        const c = String(t.category ?? "").trim();
        if (!c) continue;
        byCat.set(c, (byCat.get(c) ?? 0) + t.amount);
      }
      return Array.from(byCat.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, a]) => ({ category: c, total: Math.round(a * 100) / 100 }));
    })();

    const prompt =
      "You are a friendly personal finance assistant. " +
      "Write 1-2 sentences of insight, grounded in the numbers. " +
      "Then suggest 1-3 concise tips. " +
      "Return ONLY valid JSON with keys: insight (string), tips (array of {title, detail}). " +
      "Avoid shame, keep it practical." +
      `\n\nData:\n- totalSpent: ${totalSpent.toFixed(2)}\n- count: ${count}\n- avg: ${avg.toFixed(2)}\n- max: ${max.toFixed(2)}\n- topCategories: ${JSON.stringify(topCategories)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let modelInsight = "";
    let tips: Array<{ title: string; detail: string }> = [];
    try {
      const parsed = JSON.parse(raw);
      modelInsight = typeof parsed?.insight === "string" ? parsed.insight : "";
      tips = Array.isArray(parsed?.tips)
        ? parsed.tips
            .filter((t: any) => t && typeof t.title === "string" && typeof t.detail === "string")
            .slice(0, 3)
        : [];
    } catch {
      modelInsight = raw;
    }

    const fallbackInsight =
      count > 0
        ? `You logged ${count} purchases totaling $${totalSpent.toFixed(2)} (avg $${avg.toFixed(2)}).`
        : `No spending transactions provided for this period.`;

    const insight = (modelInsight || fallbackInsight).trim();

    return NextResponse.json({ totalSpent, insight, tips, stats: { count, avg, max, topCategories } });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
