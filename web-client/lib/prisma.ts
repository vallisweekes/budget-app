import { enforceServerOnlyRuntime } from "@/lib/serverOnly";

enforceServerOnlyRuntime();

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isRetryableConnectionError } from "@/lib/prismaRetry";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaHash?: string;
  prismaRuntimeHash?: string;
};

function parsePositiveInt(raw: unknown, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function getPrismaRuntimeTuning() {
  const isDev = process.env.NODE_ENV !== "production";
  return {
    connectionLimit: isDev
      ? parsePositiveInt(process.env.PRISMA_DEV_CONNECTION_LIMIT ?? "5", 5)
      : parsePositiveInt(process.env.PRISMA_CONNECTION_LIMIT ?? "10", 10),
    poolTimeoutSeconds: isDev
      ? parsePositiveInt(process.env.PRISMA_DEV_POOL_TIMEOUT_SECONDS ?? "3", 3)
      : parsePositiveInt(process.env.PRISMA_POOL_TIMEOUT_SECONDS ?? "20", 20),
    connectTimeoutSeconds: isDev
      ? parsePositiveInt(process.env.PRISMA_DEV_CONNECT_TIMEOUT_SECONDS ?? "5", 5)
      : parsePositiveInt(process.env.PRISMA_CONNECT_TIMEOUT_SECONDS ?? "15", 15),
  };
}

function getPrismaSchemaHash(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, "prisma", "schema.prisma"),
      path.join(cwd, "web-client", "prisma", "schema.prisma"),
    ];
    const schemaPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!schemaPath) return undefined;
    const schema = fs.readFileSync(schemaPath, "utf8");
    return createHash("sha1").update(schema).digest("hex");
  } catch {
    return undefined;
  }
}

function withConnectionLimits(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const tuning = getPrismaRuntimeTuning();
    // Keep Prisma's pool small in dev to avoid exhausting DB connections
    // (especially with Turbopack / RSC which can trigger many parallel renders).
    // Also fail fast on stale pooled connections so request-time retries can reconnect
    // instead of waiting 20s+ on a dead connection during local development.
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", String(tuning.connectionLimit));
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", String(tuning.poolTimeoutSeconds));
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", String(tuning.connectTimeoutSeconds));
    }
    if (parsed.searchParams.get("pgbouncer") === "true" && !parsed.searchParams.has("statement_cache_size")) {
      parsed.searchParams.set("statement_cache_size", "0");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function resolvePrismaUrl(): string | undefined {
  // Runtime should prefer a pooled URL; reserve *_UNPOOLED for migrations/one-off scripts.
  return withConnectionLimits(
    process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  );
}

function getPrismaRuntimeHash(url: string | undefined): string | undefined {
	if (process.env.NODE_ENV === "production") return undefined;
	return createHash("sha1").update(url ?? "").digest("hex");
}

const prismaSchemaHash = getPrismaSchemaHash();
const prismaRuntimeUrl = resolvePrismaUrl();
const prismaRuntimeHash = getPrismaRuntimeHash(prismaRuntimeUrl);

const RETRYABLE_READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "queryRaw",
]);

let reconnectInFlight: Promise<void> | null = null;

let connectInFlight: Promise<void> | null = null;

async function ensureConnected(client: PrismaClient): Promise<void> {
  if (!connectInFlight) {
    connectInFlight = (async () => {
      try {
        await client.$connect();
      } catch {
        // Best-effort: actual query retry will surface persistent failures.
      }
    })().finally(() => {
      connectInFlight = null;
    });
  }
  await connectInFlight;
}

async function reconnectClient(client: PrismaClient): Promise<void> {
  if (!reconnectInFlight) {
    reconnectInFlight = (async () => {
      try {
        await client.$disconnect();
      } catch {
        // ignore; we only need a clean reconnect attempt
      }

      try {
        await client.$connect();
      } catch {
        await sleep(75);
        await client.$connect();
      }
    })().finally(() => {
      reconnectInFlight = null;
    });
  }
  await reconnectInFlight;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const basePrisma =
  globalForPrisma.prisma &&
  (!prismaSchemaHash || globalForPrisma.prismaSchemaHash === prismaSchemaHash) &&
  (!prismaRuntimeHash || globalForPrisma.prismaRuntimeHash === prismaRuntimeHash)
    ? globalForPrisma.prisma
    : new PrismaClient({
    datasources: {
      db: {
        url: prismaRuntimeUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

export const prisma: PrismaClient = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          const isSafeRead = RETRYABLE_READ_OPERATIONS.has(operation);
          if (!isSafeRead || !isRetryableConnectionError(error)) {
            throw error;
          }

          let lastError: unknown = error;
          for (let attempt = 0; attempt < 4; attempt += 1) {
            await reconnectClient(basePrisma);
            await sleep(60 + attempt * 120);
            try {
              return await query(args);
            } catch (retryError) {
              lastError = retryError;
              if (!isRetryableConnectionError(retryError)) {
                throw retryError;
              }
            }
          }

          throw lastError;
        }
      },
    },
  },
}) as unknown as PrismaClient;

// Proactively start the Prisma engine in dev so the first request doesn't race it.
if (process.env.NODE_ENV !== "production") {
  void ensureConnected(basePrisma);
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
  globalForPrisma.prismaSchemaHash = prismaSchemaHash;
  globalForPrisma.prismaRuntimeHash = prismaRuntimeHash;
}
