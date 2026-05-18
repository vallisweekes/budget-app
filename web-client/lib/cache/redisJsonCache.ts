import { getRedisClient } from "@/lib/redis";

type LocalCacheEntry<T> = {
	expiresAt: number;
	value: T;
};

const localCache = new Map<string, LocalCacheEntry<unknown>>();

const REDIS_CACHE_OPERATION_TIMEOUT_MS = (() => {
	const raw = Number(process.env.REDIS_CACHE_OPERATION_TIMEOUT_MS ?? 250);
	if (!Number.isFinite(raw)) return 250;
	return Math.max(100, Math.min(2_000, Math.floor(raw)));
})();

async function withRedisOperationTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeout = new Promise<T>((resolve) => {
			timeoutId = setTimeout(() => resolve(fallback), REDIS_CACHE_OPERATION_TIMEOUT_MS);
		});
		return await Promise.race([promise, timeout]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

function getNamespacedKey(key: string): string {
	return `budget-app:${key}`;
}

function deleteLocalCacheByPrefix(prefix: string): void {
	for (const key of localCache.keys()) {
		if (key.startsWith(prefix)) {
			localCache.delete(key);
		}
	}
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
	const local = localCache.get(key) as LocalCacheEntry<T> | undefined;
	if (local && local.expiresAt > Date.now()) {
		return local.value;
	}
	if (local) {
		localCache.delete(key);
	}

	const client = await getRedisClient();
	if (!client) return null;

	try {
		const raw = await withRedisOperationTimeout(client.get(getNamespacedKey(key)), null);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export async function setJsonCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	localCache.set(key, {
		expiresAt: Date.now() + ttlSeconds * 1000,
		value,
	});

	const client = await getRedisClient();
	if (!client) return;

	try {
		await withRedisOperationTimeout(client.set(getNamespacedKey(key), JSON.stringify(value), {
			EX: Math.max(1, Math.floor(ttlSeconds)),
		}), null);
		return;
	} catch {
		return;
	}
}

export async function deleteJsonCache(key: string): Promise<void> {
	localCache.delete(key);

	const client = await getRedisClient();
	if (!client) return;

	try {
		await withRedisOperationTimeout(client.del(getNamespacedKey(key)), null);
	} catch {
		return;
	}
}

export async function deleteJsonCacheByPrefix(prefix: string): Promise<void> {
	deleteLocalCacheByPrefix(prefix);

	const client = await getRedisClient();
	if (!client) return;

	try {
		let cursor = "0";
		const match = getNamespacedKey(`${prefix}*`);

		do {
			const result = await withRedisOperationTimeout(client.scan(cursor, {
				MATCH: match,
				COUNT: 100,
			}), { cursor: "0", keys: [] as string[] });
			cursor = result.cursor;
			if (result.keys.length > 0) {
				await withRedisOperationTimeout(client.del(result.keys), null);
			}
		} while (cursor !== "0");
	} catch {
		return;
	}
}