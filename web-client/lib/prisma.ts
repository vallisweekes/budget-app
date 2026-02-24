import "server-only";

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isRetryableConnectionError } from "@/lib/prismaRetry";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaHash?: string;
};

function getPrismaSchemaHash(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
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
    // Keep Prisma's pool small in dev to avoid exhausting DB connections
    // (especially with Turbopack / RSC which can trigger many parallel renders).
    if (!parsed.searchParams.has("connection_limit")) {
      const isDev = process.env.NODE_ENV !== "production";
      parsed.searchParams.set("connection_limit", isDev ? "5" : "10");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "15");
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

const prismaSchemaHash = getPrismaSchemaHash();

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

async function reconnectClient(client: PrismaClient): Promise<void> {
  if (!reconnectInFlight) {
    reconnectInFlight = (async () => {
      try {
        await client.$disconnect();
      } catch {
      }
      try {
        await client.$connect();
      } catch {
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
  globalForPrisma.prisma && (!prismaSchemaHash || globalForPrisma.prismaSchemaHash === prismaSchemaHash)
    ? globalForPrisma.prisma
    : new PrismaClient({
    datasources: {
      db: {
        url: resolvePrismaUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

export const prisma = basePrisma.$extends({
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

          await reconnectClient(basePrisma);
          await sleep(40);
          return await query(args);
        }
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
  globalForPrisma.prismaSchemaHash = prismaSchemaHash;
}
