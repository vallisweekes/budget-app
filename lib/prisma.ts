import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolvePrismaUrl(): string | undefined {
	const isDev = process.env.NODE_ENV !== "production";
	return (
		process.env.POSTGRES_PRISMA_URL ||
		(isDev ? process.env.DATABASE_URL_UNPOOLED : undefined) ||
		process.env.DATABASE_URL
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
