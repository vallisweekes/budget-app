import AsyncStorage from "@react-native-async-storage/async-storage";

type PersistedApiCacheEntry<T> = {
  cachedAt: number;
  value: T;
};

const API_OFFLINE_CACHE_INDEX_KEY = "budget_app.api_offline_cache.index";
const API_OFFLINE_CACHE_PREFIX = "budget_app.api_offline_cache.";

function buildStorageKey(requestKey: string): string {
  return `${API_OFFLINE_CACHE_PREFIX}${encodeURIComponent(requestKey)}`;
}

async function readStoredIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(API_OFFLINE_CACHE_INDEX_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

async function writeStoredIndex(keys: string[]): Promise<void> {
  try {
    const uniqueKeys = Array.from(new Set(keys));
    await AsyncStorage.setItem(API_OFFLINE_CACHE_INDEX_KEY, JSON.stringify(uniqueKeys));
  } catch {
    // Ignore storage failures so API requests still complete.
  }
}

export async function readOfflineApiCache<T>(requestKey: string): Promise<PersistedApiCacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(buildStorageKey(requestKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("cachedAt" in parsed) || !("value" in parsed)) {
      return null;
    }

    return {
      cachedAt: typeof parsed.cachedAt === "number" ? parsed.cachedAt : Date.now(),
      value: parsed.value as T,
    };
  } catch {
    return null;
  }
}

export async function writeOfflineApiCache(requestKey: string, value: unknown): Promise<void> {
  const storageKey = buildStorageKey(requestKey);

  try {
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        cachedAt: Date.now(),
        value,
      })
    );

    const index = await readStoredIndex();
    if (!index.includes(storageKey)) {
      await writeStoredIndex([...index, storageKey]);
    }
  } catch {
    // Ignore storage failures so successful API responses still return.
  }
}

export async function clearOfflineApiCache(): Promise<void> {
  try {
    const index = await readStoredIndex();
    const keysToRemove = index.length > 0
      ? [...index, API_OFFLINE_CACHE_INDEX_KEY]
      : [API_OFFLINE_CACHE_INDEX_KEY];

    await AsyncStorage.multiRemove(keysToRemove);
  } catch {
    try {
      await AsyncStorage.removeItem(API_OFFLINE_CACHE_INDEX_KEY);
    } catch {
      // Ignore storage failures while invalidating cache.
    }
  }
}