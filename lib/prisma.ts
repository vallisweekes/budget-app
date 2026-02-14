import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvePrismaUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
