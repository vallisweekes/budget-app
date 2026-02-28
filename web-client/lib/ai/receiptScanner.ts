/**
 * receiptScanner.ts
 *
 * Uses OpenAI Vision (gpt-4o-mini) to extract structured data from a
 * receipt image provided as a base64 string.
 *
 * Returns a best-effort ParsedReceipt — all fields are nullable since
 * OCR conditions vary wildly.  The caller must let the user verify/correct
 * before saving.
 */

import OpenAI from "openai";

export interface ParsedReceipt {
  merchant: string | null;
  /** Numeric total amount (pay attention to the largest total line, not sub-totals) */
  amount: number | null;
  currency: string | null;
  /** ISO-8601 date string or null */
  date: string | null;
  /** Natural-language category suggestion e.g. "Groceries", "Transport" */
  suggestedCategory: string | null;
  /** Any extra notes extracted (optional) */
  notes: string | null;
}

const SYSTEM_PROMPT = `You are a receipt parsing assistant for a personal budgeting app.
Given a receipt image, extract the following as JSON — nothing else:
{
  "merchant": string | null,
  "amount": number | null,
  "currency": string | null,  (ISO-4217 code, e.g. "GBP", "USD")
  "date": string | null,      (ISO-8601 YYYY-MM-DD)
  "suggestedCategory": string | null,
  "notes": string | null
}

Rules:
- amount must be the FINAL total paid, not a subtotal or VAT line
- If a field is unclear or missing, output null for that field
- suggestedCategory should be one of: Groceries, Transport, Dining, Entertainment, Health, Housing, Utilities, Clothing, Childcare, Personal Care, Shopping, Travel, or Other
- Do NOT include markdown, code blocks, or any text outside the JSON object`;


type OpenAIError = { status?: number; message?: string };

function isOpenAIError(e: unknown): e is OpenAIError {
  return typeof e === "object" && e !== null;
}

const MIME_BY_BASE64_PREFIX: Record<string, string> = {
  "/9j/": "image/jpeg",
  "iVBOR": "image/png",
  "R0lGO": "image/gif",
  "UklGR": "image/webp",
};

function stripDataUrlPrefix(raw: string): string {
  return raw.includes("base64,") ? (raw.split(",").pop() ?? raw) : raw;
}

function sniffMimeFromBase64(base64: string): string {
  const trimmed = base64.trim();
  const prefix = trimmed.slice(0, 5);
  const match = Object.entries(MIME_BY_BASE64_PREFIX).find(([p]) => prefix.startsWith(p));
  return match?.[1] ?? "image/jpeg";
}

function safeParseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), ms);
    });
    return (await Promise.race([promise, timeout])) as T | null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const EMPTY: ParsedReceipt = {
  merchant: null,
  amount: null,
  currency: null,
  date: null,
  suggestedCategory: null,
  notes: null,
};

function toParsedReceipt(obj: Record<string, unknown> | null, rawForDebug: string): ParsedReceipt {
  if (!obj) {
    console.warn("[receiptScanner] Could not parse AI response:", rawForDebug);
    return EMPTY;
  }

  const amount =
    typeof obj.amount === "number" && Number.isFinite(obj.amount) && obj.amount >= 0 ? obj.amount : null;

  return {
    merchant: typeof obj.merchant === "string" ? obj.merchant : null,
    amount,
    currency: typeof obj.currency === "string" ? obj.currency : null,
    date: typeof obj.date === "string" ? obj.date : null,
    suggestedCategory: typeof obj.suggestedCategory === "string" ? obj.suggestedCategory : null,
    notes: typeof obj.notes === "string" ? obj.notes : null,
  };
}

async function runVisionParse(params: {
  client: OpenAI;
  base64Image: string;
  userCategories: string[];
  detail: "low" | "high";
}): Promise<ParsedReceipt | null> {
  const categoryHint =
    params.userCategories.length > 0
      ? `The user has these budget categories: ${params.userCategories.join(", ")}. ` +
        `If possible, suggest one of these exact names for suggestedCategory.`
      : "";

  const completion = await withTimeout(
    params.client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 350,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the receipt data as JSON. ${categoryHint}`.trim(),
            },
            {
              type: "image_url",
              image_url: {
                url: params.base64Image,
                detail: params.detail,
              },
            },
          ],
        },
      ],
    }),
    4_500,
  );

  if (!completion) return null;

  const raw = completion.choices[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const obj = safeParseJsonObject(cleaned);
  return toParsedReceipt(obj, raw);
}

export async function parseReceiptImage(
  base64Image: string,
  userCategories: string[],
): Promise<ParsedReceipt> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[receiptScanner] OPENAI_API_KEY is not set; returning empty parsed receipt");
    return EMPTY;
  }

  const client = new OpenAI({ apiKey });

  const normalized = stripDataUrlPrefix(base64Image);
  const mime = sniffMimeFromBase64(normalized);
  const dataUrl = `data:${mime};base64,${normalized}`;

  try {
    const low = await runVisionParse({
      client,
      base64Image: dataUrl,
      userCategories,
      detail: "low",
    });
    if (!low) return EMPTY;

    const gotSomething = Boolean(low.merchant || low.amount || low.currency || low.date || low.suggestedCategory);
    if (gotSomething) return low;

    // If the cheap pass returns nothing useful, retry with higher image detail.
    const high = await runVisionParse({
      client,
      base64Image: dataUrl,
      userCategories,
      detail: "high",
    });

    return high ?? low;
  } catch (e: unknown) {
    if (isOpenAIError(e) && e.status === 400) {
      console.warn("[receiptScanner] OpenAI rejected image (400):", e.message);
      return EMPTY;
    }

    // Any other AI/network/rate-limit error: best-effort return empties so the
    // user can still manually enter details (and we avoid hard-failing the scan).
    const status = isOpenAIError(e) ? e.status : undefined;
    const message = isOpenAIError(e) ? e.message : undefined;
    console.warn("[receiptScanner] OpenAI request failed; returning empty parsed receipt", { status, message });
    return EMPTY;
  }
}
