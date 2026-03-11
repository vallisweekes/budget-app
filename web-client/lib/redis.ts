import { createClient, type RedisClientType } from "redis";

import { enforceServerOnlyRuntime } from "@/lib/serverOnly";

enforceServerOnlyRuntime();

type GlobalRedisState = typeof globalThis & {
	__budgetAppRedisClient?: RedisClientType;
	__budgetAppRedisConnectPromise?: Promise<RedisClientType | null> | null;
	__budgetAppRedisLoggedError?: boolean;
};

const globalRedis = globalThis as GlobalRedisState;

function getRedisUrl(): string | null {
	const value = String(process.env.REDIS_URL ?? "").trim();
	return value ? value : null;
}

function logRedisErrorOnce(error: unknown) {
	if (globalRedis.__budgetAppRedisLoggedError) return;
	globalRedis.__budgetAppRedisLoggedError = true;
	console.error("Redis unavailable; falling back to local in-process cache", error);
}

export function isRedisConfigured(): boolean {
	return Boolean(getRedisUrl());
}

export async function getRedisClient(): Promise<RedisClientType | null> {
	const url = getRedisUrl();
	if (!url) return null;

	if (globalRedis.__budgetAppRedisClient?.isReady) {
		return globalRedis.__budgetAppRedisClient;
	}

	if (!globalRedis.__budgetAppRedisConnectPromise) {
		globalRedis.__budgetAppRedisConnectPromise = (async () => {
			try {
				const client = globalRedis.__budgetAppRedisClient ?? createClient({ url });
				client.on("error", (error) => {
					logRedisErrorOnce(error);
				});

				if (!client.isOpen) {
					await client.connect();
				}

				globalRedis.__budgetAppRedisClient = client;
				return client;
			} catch (error) {
				logRedisErrorOnce(error);
				return null;
			} finally {
				globalRedis.__budgetAppRedisConnectPromise = null;
			}
		})();
	}

	return globalRedis.__budgetAppRedisConnectPromise;
}