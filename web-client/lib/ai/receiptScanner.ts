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

export async function parseReceiptImage(
  base64Image: string,
  userCategories: string[],
): Promise<ParsedReceipt> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });

  const categoryHint =
    userCategories.length > 0
      ? `The user has these budget categories: ${userCategories.join(", ")}. ` +
        `If possible, suggest one of these exact names for suggestedCategory.`
      : "";

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
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
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low", // cheaper + fast enough for receipts
              },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    // Strip any markdown fences the model might have added
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Model returned non-JSON — return all-null so caller shows empty form
      console.warn("[receiptScanner] Could not parse AI response:", raw);
      return { merchant: null, amount: null, currency: null, date: null, suggestedCategory: null, notes: null };
    }

    const amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount >= 0
      ? parsed.amount
      : null;

    return {
      merchant:           typeof parsed.merchant === "string"          ? parsed.merchant           : null,
      amount,
      currency:           typeof parsed.currency === "string"          ? parsed.currency           : null,
      date:               typeof parsed.date === "string"              ? parsed.date               : null,
      suggestedCategory:  typeof parsed.suggestedCategory === "string" ? parsed.suggestedCategory  : null,
      notes:              typeof parsed.notes === "string"             ? parsed.notes              : null,
    };
  } catch (e: unknown) {
    if (isOpenAIError(e) && e.status === 400) {
      // Bad image data — return empty so user can fill manually
      console.warn("[receiptScanner] OpenAI rejected image (400):", e.message);
      return { merchant: null, amount: null, currency: null, date: null, suggestedCategory: null, notes: null };
    }
    throw e;
  }
}
