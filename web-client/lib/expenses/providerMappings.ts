import { prisma } from "@/lib/prisma";

type ProviderRow = {
  providerName: string;
  aliases: string[];
  categoryName: string;
};

type ProviderMappingDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<ProviderRow[]>;
  upsert: (args: Record<string, unknown>) => Promise<unknown>;
};

const UK_DEFAULT_MOBILE_PROVIDER_MAPPINGS: Array<{
  providerName: string;
  aliases: string[];
  categoryName: "Utilities";
}> = [
  { providerName: "EE", aliases: ["ee"], categoryName: "Utilities" },
  { providerName: "Vodafone", aliases: ["vodafone"], categoryName: "Utilities" },
  { providerName: "O2", aliases: ["o2", "telefonica o2"], categoryName: "Utilities" },
  { providerName: "Three", aliases: ["three", "3"], categoryName: "Utilities" },
  { providerName: "giffgaff", aliases: ["giffgaff"], categoryName: "Utilities" },
  { providerName: "VOXI", aliases: ["voxi"], categoryName: "Utilities" },
  { providerName: "SMARTY", aliases: ["smarty"], categoryName: "Utilities" },
  { providerName: "Lebara", aliases: ["lebara"], categoryName: "Utilities" },
  { providerName: "Lyca Mobile", aliases: ["lyca", "lycamobile", "lyca mobile"], categoryName: "Utilities" },
  { providerName: "Tesco Mobile", aliases: ["tesco mobile"], categoryName: "Utilities" },
  { providerName: "Sky Mobile", aliases: ["sky mobile"], categoryName: "Utilities" },
  { providerName: "iD Mobile", aliases: ["id mobile", "i d mobile"], categoryName: "Utilities" },
  { providerName: "Virgin Media", aliases: ["virgin media", "virgin"], categoryName: "Utilities" },
  { providerName: "BT Mobile", aliases: ["bt mobile"], categoryName: "Utilities" },
  { providerName: "Talkmobile", aliases: ["talkmobile", "talk mobile"], categoryName: "Utilities" },
  { providerName: "ASDA Mobile", aliases: ["asda mobile"], categoryName: "Utilities" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;

let mappingsCache: { expiresAt: number; rows: ProviderRow[] } | null = null;
let hasAttemptedSeed = false;

function normalizeText(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function splitTokens(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function hasModel(modelName: string): boolean {
  try {
    const runtimeDataModel = (prisma as unknown as {
      _runtimeDataModel?: {
        models?: Record<string, unknown>;
      };
    })._runtimeDataModel;
    return Boolean(runtimeDataModel?.models?.[modelName]);
  } catch {
    return false;
  }
}

function getProviderDelegate(client: unknown): ProviderMappingDelegate | null {
  const delegate = (client as { expenseProviderMapping?: ProviderMappingDelegate }).expenseProviderMapping;
  return delegate ?? null;
}

async function ensureDefaultUkMappingsSeeded(): Promise<void> {
  if (hasAttemptedSeed) return;
  hasAttemptedSeed = true;

  if (!hasModel("ExpenseProviderMapping")) return;
  const delegate = getProviderDelegate(prisma);
  if (!delegate) return;

  try {
    for (const mapping of UK_DEFAULT_MOBILE_PROVIDER_MAPPINGS) {
      await delegate.upsert({
        where: {
          countryCode_providerName: {
            countryCode: "GB",
            providerName: mapping.providerName,
          },
        },
        update: {
          aliases: mapping.aliases,
          categoryName: mapping.categoryName,
          isActive: true,
        },
        create: {
          countryCode: "GB",
          providerName: mapping.providerName,
          aliases: mapping.aliases,
          categoryName: mapping.categoryName,
          isActive: true,
        },
      });
    }
  } catch {
    // Best-effort only.
  }
}

async function getActiveUkMappings(): Promise<ProviderRow[]> {
  const now = Date.now();
  if (mappingsCache && mappingsCache.expiresAt > now) {
    return mappingsCache.rows;
  }

  await ensureDefaultUkMappingsSeeded();

  let rows: ProviderRow[] = [];

  if (hasModel("ExpenseProviderMapping")) {
    const delegate = getProviderDelegate(prisma);
    if (delegate) {
      try {
        rows = await delegate.findMany({
          where: {
            countryCode: "GB",
            isActive: true,
          },
          select: {
            providerName: true,
            aliases: true,
            categoryName: true,
          },
        });
      } catch {
        rows = [];
      }
    }
  }

  if (!rows.length) {
    rows = UK_DEFAULT_MOBILE_PROVIDER_MAPPINGS.map((item) => ({
      providerName: item.providerName,
      aliases: item.aliases,
      categoryName: item.categoryName,
    }));
  }

  mappingsCache = {
    expiresAt: now + CACHE_TTL_MS,
    rows,
  };

  return rows;
}

function aliasMatchesExpense(expenseName: string, alias: string): boolean {
  const normalizedExpense = normalizeText(expenseName);
  const normalizedAlias = normalizeText(alias);
  if (!normalizedExpense || !normalizedAlias) return false;

  const aliasTokens = splitTokens(normalizedAlias);
  if (!aliasTokens.length) return false;

  // Very short aliases like "ee", "o2" and "3" should only match complete tokens.
  if (normalizedAlias.length <= 2 || aliasTokens.length === 1 && aliasTokens[0].length <= 2) {
    const expenseTokens = splitTokens(normalizedExpense);
    return expenseTokens.includes(normalizedAlias);
  }

  return normalizedExpense.includes(normalizedAlias);
}

export async function suggestProviderMappedCategory(params: {
  expenseName: string;
  availableCategories: string[];
}): Promise<string | null> {
  const expenseName = String(params.expenseName ?? "").trim();
  if (!expenseName) return null;

  const available = (params.availableCategories ?? []).filter(Boolean);
  if (!available.length) return null;

  const rows = await getActiveUkMappings();

  for (const row of rows) {
    const aliases = [row.providerName, ...(Array.isArray(row.aliases) ? row.aliases : [])];
    const matched = aliases.some((alias) => aliasMatchesExpense(expenseName, alias));
    if (!matched) continue;

    const wantedCategory = normalizeText(row.categoryName);
    const availableMatch = available.find((c) => normalizeText(c) === wantedCategory) ?? null;
    if (availableMatch) return availableMatch;
  }

  return null;
}

export async function ensureUkMobileProviderMappingsSeeded(): Promise<void> {
  await ensureDefaultUkMappingsSeeded();
}