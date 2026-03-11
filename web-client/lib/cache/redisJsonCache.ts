import { getRedisClient } from "@/lib/redis";

type LocalCacheEntry<T> = {
	expiresAt: number;
	value: T;
};

const localCache = new Map<string, LocalCacheEntry<unknown>>();

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
		const raw = await client.get(getNamespacedKey(key));
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
		await client.set(getNamespacedKey(key), JSON.stringify(value), {
			EX: Math.max(1, Math.floor(ttlSeconds)),
		});
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
		await client.del(getNamespacedKey(key));
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
			const result = await client.scan(cursor, {
				MATCH: match,
				COUNT: 100,
			});
			cursor = result.cursor;
			if (result.keys.length > 0) {
				await client.del(result.keys);
			}
		} while (cursor !== "0");
	} catch {
		return;
	}
}