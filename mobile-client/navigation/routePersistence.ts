import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "@/lib/api";

const ROUTE_PERSIST_VERSION = "router-v1";
const ROUTE_LAST_KEY = `budget_app.route_state.last_key.${ROUTE_PERSIST_VERSION}`;

type PersistedRoutePayload = {
  href: string;
};

function routeStateKeyForUser(username: string | null): string | null {
  const normalizedUsername = (username ?? "").trim().toLowerCase();
  if (!normalizedUsername) return null;
  return `budget_app.route_state.${ROUTE_PERSIST_VERSION}.${normalizedUsername}`;
}

function parsePersistedHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedRoutePayload;
    if (typeof parsed?.href === "string" && parsed.href.startsWith("/")) {
      return parsed.href;
    }
  } catch {
    // ignore legacy or malformed state
  }
  return null;
}

export function buildPersistedHref(pathname: string, params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry != null) search.append(key, String(entry));
      });
      return;
    }
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function clearPersistedRoute(username: string | null) {
  const persistKey = routeStateKeyForUser(username);
  try {
    const lastKey = await AsyncStorage.getItem(ROUTE_LAST_KEY);
    if (persistKey && lastKey === persistKey) {
      await AsyncStorage.removeItem(ROUTE_LAST_KEY);
    }
    if (persistKey) {
      await AsyncStorage.removeItem(persistKey);
    }
  } catch {
    // ignore
  }
}

export async function loadPersistedHref(username: string | null): Promise<string | null> {
  const persistKey = routeStateKeyForUser(username);
  if (!persistKey) return null;

  try {
    let raw = await AsyncStorage.getItem(persistKey);

    if (!raw) {
      const remote = await apiFetch<{ stateJson: string | null }>("/api/bff/navigation/state", {
        cacheTtlMs: 0,
        skipOnUnauthorized: true,
      });
      raw = typeof remote?.stateJson === "string" ? remote.stateJson : "";
      if (raw) {
        await AsyncStorage.setItem(persistKey, raw);
      }
    }

    const href = parsePersistedHref(raw);
    if (href) {
      await AsyncStorage.setItem(ROUTE_LAST_KEY, persistKey);
    }
    return href;
  } catch {
    return null;
  }
}

export async function savePersistedHrefLocal(username: string | null, href: string) {
  const persistKey = routeStateKeyForUser(username);
  if (!persistKey) return;

  const raw = JSON.stringify({ href } satisfies PersistedRoutePayload);
  await AsyncStorage.setItem(persistKey, raw);
  await AsyncStorage.setItem(ROUTE_LAST_KEY, persistKey);
}

export async function flushPersistedHrefRemote(username: string | null, href: string) {
  const persistKey = routeStateKeyForUser(username);
  if (!persistKey || !href) return;

  await apiFetch("/api/bff/navigation/state", {
    method: "PUT",
    body: { stateJson: JSON.stringify({ href } satisfies PersistedRoutePayload) },
    cacheTtlMs: 0,
    skipOnUnauthorized: true,
  });
}