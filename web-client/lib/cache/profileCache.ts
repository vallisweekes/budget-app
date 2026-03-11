import { deleteJsonCacheByPrefix } from "@/lib/cache/redisJsonCache";

const PROFILE_CACHE_VERSION = "v1";
export const PROFILE_CACHE_TTL_SECONDS = 60;

export function getProfileCachePrefix(userId: string): string {
	return `profile:${PROFILE_CACHE_VERSION}:${userId}:`;
}

export function getProfileCacheKey(userId: string): string {
	return `${getProfileCachePrefix(userId)}me`;
}

export async function invalidateProfileCache(userId: string): Promise<void> {
	const trimmedUserId = userId.trim();
	if (!trimmedUserId) return;
	await deleteJsonCacheByPrefix(getProfileCachePrefix(trimmedUserId));
}
