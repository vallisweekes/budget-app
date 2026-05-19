import type { PayFrequency } from "@/lib/payPeriods";
import { prisma } from "@/lib/prisma";

import type { OnboardingDelegate } from "./types";

export function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

export function isPrismaValidationError(err: unknown, contains: string): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { name?: unknown; message?: unknown };
  return maybe.name === "PrismaClientValidationError"
    && typeof maybe.message === "string"
    && maybe.message.includes(contains);
}

function messageIncludesAny(message: string, needles: string[]): boolean {
  const normalized = message.toLowerCase();
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

export function isPotentialLegacyExpenseSchemaError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  if (!message) return false;
  return messageIncludesAny(message, [
    "isAllocation",
    "isMovedToDebt",
    "isExtraLoggedExpense",
    "isDirectDebit",
    "dueDate",
    "Unknown arg",
    "P2022",
    "does not exist",
  ]);
}

export function prismaUserHasField(fieldName: string): boolean {
  try {
    const runtimeDataModel = (prisma as unknown as {
      _runtimeDataModel?: { models?: Record<string, { fields?: Array<{ name?: string }> }> };
    })._runtimeDataModel;
    const fields = runtimeDataModel?.models?.User?.fields;
    return Array.isArray(fields) && fields.some((field) => field?.name === fieldName);
  } catch {
    return false;
  }
}

export function onboardingDelegate(client: unknown): OnboardingDelegate {
  return (client as { userOnboardingProfile: OnboardingDelegate }).userOnboardingProfile;
}

export function toAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Number(value.toFixed(2)));
}

export function clampPayDay(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(31, Math.trunc(value)));
}

export function cleanPayFrequency(value: unknown): PayFrequency | null {
  return value === "monthly" || value === "every_2_weeks" || value === "every_4_weeks" || value === "weekly"
    ? value
    : null;
}

export function cleanPayAnchorDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const parsed = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
      ? new Date(`${value.trim()}T00:00:00.000Z`)
      : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function cleanBillFrequency(value: unknown): "monthly" | "every_2_weeks" | null {
  return value === "monthly" || value === "every_2_weeks" ? value : null;
}

export function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function toPositiveAmount(value: unknown): number | null {
  const numeric = toNullableNumber(value);
  if (numeric == null || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
}

export function clampIntRange(value: number | null | undefined, min: number, max: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}